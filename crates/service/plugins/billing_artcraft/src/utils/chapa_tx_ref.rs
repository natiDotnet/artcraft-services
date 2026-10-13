use chrono::Utc;
use enums::common::artcraft_subscription_slug::ArtcraftSubscriptionSlug;

use crate::configs::subscriptions::etb_artcraft_subscription_info::EtbSubscriptionBillingPeriod;

/// A Chapa `tx_ref` is the merchant-generated transaction reference. It is the
/// ONLY identifier Chapa echoes back on redirect and in verification
/// responses, so it must carry everything we need to fulfill the payment:
/// who is paying and for what. It is also the `user_spend_events`
/// `source_object_id` dedup anchor (payment_source = 'chapa'), so uniqueness
/// matters: we append a unix-nanosecond timestamp.
///
/// Format (dash-separated -- user tokens, plan slugs, and ETB pack ids never
/// contain dashes):
///
/// - Subscription: `artcraft-sub-{user_token}-{plan_slug}-{period}-{nanos}`
/// - Credits pack: `artcraft-pack-{user_token}-{pack_id}-{nanos}`
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChapaTxRefPayload {
  Subscription {
    user_token: String,
    slug: ArtcraftSubscriptionSlug,
    period: EtbSubscriptionBillingPeriod,
  },
  CreditsPack {
    user_token: String,
    pack_id: String,
  },
}

impl ChapaTxRefPayload {
  pub fn user_token(&self) -> &str {
    match self {
      Self::Subscription { user_token, .. } => user_token,
      Self::CreditsPack { user_token, .. } => user_token,
    }
  }

  /// Aliased decode constructor. Kept as an inherent method so call sites
  /// read symmetrically with `to_tx_ref` (and so tests can use it).
  pub fn from_tx_ref(tx_ref: &str) -> Option<Self> {
    decode_tx_ref(tx_ref)
  }

  /// Build the `tx_ref` string to hand to Chapa.
  pub fn to_tx_ref(&self) -> String {
    let nanos = Utc::now().timestamp_nanos_opt().unwrap_or_else(|| Utc::now().timestamp() * 1_000_000_000);
    match self {
      Self::Subscription { user_token, slug, period } => {
        format!("artcraft-sub-{}-{}-{}-{}", user_token, slug.to_str(), period.to_str(), nanos)
      }
      Self::CreditsPack { user_token, pack_id } => {
        format!("artcraft-pack-{}-{}-{}", user_token, pack_id, nanos)
      }
    }
  }
}

/// Decode a `tx_ref` we generated. Returns `None` for anything that isn't
/// ours (garbage input, other systems' references, etc).
pub fn decode_tx_ref(tx_ref: &str) -> Option<ChapaTxRefPayload> {
  let rest = tx_ref.strip_prefix("artcraft-")?;
  let (kind, remainder) = rest.split_once('-')?;

  match kind {
    "sub" => {
      // {user_token}-{slug}-{period}-{nanos}
      let mut parts = remainder.split('-');
      let user_token = parts.next()?;
      let slug = ArtcraftSubscriptionSlug::from_str(parts.next()?).ok()?;
      let period = EtbSubscriptionBillingPeriod::from_str(parts.next()?).ok()?;
      let nanos = parts.next()?;
      if parts.next().is_some() || nanos.is_empty() || user_token.is_empty() {
        return None;
      }
      if nanos.parse::<i64>().is_err() {
        return None;
      }
      Some(ChapaTxRefPayload::Subscription {
        user_token: user_token.to_string(),
        slug,
        period,
      })
    }
    "pack" => {
      // {user_token}-{pack_id}-{nanos}
      let mut parts = remainder.split('-');
      let user_token = parts.next()?;
      let pack_id = parts.next()?;
      let nanos = parts.next()?;
      if parts.next().is_some() || nanos.is_empty() || user_token.is_empty() || pack_id.is_empty() {
        return None;
      }
      if nanos.parse::<i64>().is_err() {
        return None;
      }
      Some(ChapaTxRefPayload::CreditsPack {
        user_token: user_token.to_string(),
        pack_id: pack_id.to_string(),
      })
    }
    _ => None,
  }
}



#[cfg(test)]
mod tests {
  use super::*;

  mod round_trip {
    use super::*;

    #[test]
    fn subscription_round_trips() {
      let payload = ChapaTxRefPayload::Subscription {
        user_token: "u_0123456789abcdefghij".to_string(),
        slug: ArtcraftSubscriptionSlug::ArtcraftPro,
        period: EtbSubscriptionBillingPeriod::Yearly,
      };

      let tx_ref = payload.to_tx_ref();
      assert!(tx_ref.starts_with("artcraft-sub-u_0123456789abcdefghij-artcraft_pro-yearly-"));

      let decoded = ChapaTxRefPayload::from_tx_ref(&tx_ref).unwrap();
      assert_eq!(decoded, payload);
      assert_eq!(decoded.user_token(), "u_0123456789abcdefghij");
    }

    #[test]
    fn credits_pack_round_trips() {
      let payload = ChapaTxRefPayload::CreditsPack {
        user_token: "u_0123456789abcdefghij".to_string(),
        pack_id: "etb_500".to_string(),
      };

      let tx_ref = payload.to_tx_ref();
      assert!(tx_ref.starts_with("artcraft-pack-u_0123456789abcdefghij-etb_500-"));

      let decoded = ChapaTxRefPayload::from_tx_ref(&tx_ref).unwrap();
      assert_eq!(decoded, payload);
    }

    #[test]
    fn every_plan_and_period_round_trips() {
      for slug in ArtcraftSubscriptionSlug::all_variants() {
        for period in [EtbSubscriptionBillingPeriod::Monthly, EtbSubscriptionBillingPeriod::Yearly] {
          let payload = ChapaTxRefPayload::Subscription {
            user_token: "u_abcdef".to_string(),
            slug,
            period,
          };
          let tx_ref = payload.to_tx_ref();
          assert_eq!(ChapaTxRefPayload::from_tx_ref(&tx_ref), Some(payload.clone()), "tx_ref: {}", tx_ref);
        }
      }
    }
  }

  mod decode_failures {
    use super::*;

    #[test]
    fn rejects_garbage() {
      assert!(ChapaTxRefPayload::from_tx_ref("").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("some-other-system-123").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-unknown-u_abc").is_none());
    }

    #[test]
    fn rejects_bad_plan_slug_or_period() {
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-sub-u_abc-not_a_plan-monthly-123").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-sub-u_abc-artcraft_pro-weekly-123").is_none());
    }

    #[test]
    fn rejects_bad_timestamp() {
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-sub-u_abc-artcraft_pro-monthly-notanumber").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-pack-u_abc-etb_500-").is_none());
    }

    #[test]
    fn rejects_extra_fields() {
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-pack-u_abc-etb_500-123-extra").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("artcraft-sub-u_abc-artcraft_pro-monthly-123-extra").is_none());
    }
  }
}
