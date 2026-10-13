use chrono::Utc;
use enums::common::artcraft_subscription_slug::ArtcraftSubscriptionSlug;

use crate::configs::subscriptions::etb_artcraft_subscription_info::EtbSubscriptionBillingPeriod;

/// A Chapa `tx_ref` is the merchant-generated transaction reference. It is the
/// ONLY identifier Chapa echoes back on redirect and in verification
/// responses, so it must carry everything we need to fulfill the payment:
/// who is paying and for what. It is also the `user_spend_events`
/// `source_object_id` dedup anchor (payment_source = 'chapa'), so uniqueness
/// matters.
///
/// CRITICAL: Chapa strictly enforces that `tx_ref` must NOT exceed 50 characters.
///
/// Compact format (dash-separated):
/// - Subscription: `s-{user_token}-{slug_code}-{period_code}-{hex_millis}`
///   (e.g., `s-user_6neje6w8f1487-p-m-19280d46380` -> 36 chars)
/// - Credits pack: `p-{user_token}-{pack_code}-{hex_millis}`
///   (e.g., `p-user_6neje6w8f1487-1000-19280d46380` -> 37 chars)
///
/// Legacy format (for backwards compatibility):
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

  /// Build the `tx_ref` string to hand to Chapa (guaranteed <= 50 chars).
  pub fn to_tx_ref(&self) -> String {
    let millis = Utc::now().timestamp_millis();
    let tx_ref = match self {
      Self::Subscription { user_token, slug, period } => {
        format!(
          "s-{}-{}-{}-{:x}",
          user_token,
          encode_slug(*slug),
          encode_period(*period),
          millis
        )
      }
      Self::CreditsPack { user_token, pack_id } => {
        format!("p-{}-{}-{:x}", user_token, encode_pack_id(pack_id), millis)
      }
    };
    debug_assert!(tx_ref.len() <= 50, "tx_ref {:?} exceeds 50 character limit", tx_ref);
    tx_ref
  }
}

fn encode_slug(slug: ArtcraftSubscriptionSlug) -> &'static str {
  match slug {
    ArtcraftSubscriptionSlug::ArtcraftBasic => "b",
    ArtcraftSubscriptionSlug::ArtcraftPro => "p",
    ArtcraftSubscriptionSlug::ArtcraftMax => "m",
  }
}

fn decode_slug(s: &str) -> Option<ArtcraftSubscriptionSlug> {
  match s {
    "b" | "basic" | "artcraft_basic" => Some(ArtcraftSubscriptionSlug::ArtcraftBasic),
    "p" | "pro" | "artcraft_pro" => Some(ArtcraftSubscriptionSlug::ArtcraftPro),
    "m" | "max" | "artcraft_max" => Some(ArtcraftSubscriptionSlug::ArtcraftMax),
    _ => ArtcraftSubscriptionSlug::from_str(s).ok(),
  }
}

fn encode_period(period: EtbSubscriptionBillingPeriod) -> &'static str {
  match period {
    EtbSubscriptionBillingPeriod::Monthly => "m",
    EtbSubscriptionBillingPeriod::Yearly => "y",
  }
}

fn decode_period(s: &str) -> Option<EtbSubscriptionBillingPeriod> {
  match s {
    "m" | "monthly" => Some(EtbSubscriptionBillingPeriod::Monthly),
    "y" | "yearly" => Some(EtbSubscriptionBillingPeriod::Yearly),
    _ => EtbSubscriptionBillingPeriod::from_str(s).ok(),
  }
}

fn encode_pack_id(pack_id: &str) -> &str {
  pack_id.strip_prefix("etb_").unwrap_or(pack_id)
}

fn decode_pack_id(s: &str) -> Option<String> {
  match s {
    "100" | "etb_100" => Some("etb_100".to_string()),
    "300" | "etb_300" => Some("etb_300".to_string()),
    "500" | "etb_500" => Some("etb_500".to_string()),
    "1000" | "etb_1000" => Some("etb_1000".to_string()),
    other => {
      if crate::configs::credits_packs::etb_credits_pack_info_list::get_etb_credits_pack_by_id(other).is_some() {
        Some(other.to_string())
      } else {
        None
      }
    }
  }
}

/// Decode a `tx_ref` we generated. Returns `None` for anything that isn't
/// ours (garbage input, other systems' references, etc).
pub fn decode_tx_ref(tx_ref: &str) -> Option<ChapaTxRefPayload> {
  // New short subscription format: "s-{user_token}-{slug}-{period}-{timestamp}"
  if let Some(rest) = tx_ref.strip_prefix("s-") {
    let mut parts = rest.split('-');
    let user_token = parts.next()?;
    let slug = decode_slug(parts.next()?)?;
    let period = decode_period(parts.next()?)?;
    let ts = parts.next()?;
    if parts.next().is_some() || ts.is_empty() || user_token.is_empty() {
      return None;
    }
    return Some(ChapaTxRefPayload::Subscription {
      user_token: user_token.to_string(),
      slug,
      period,
    });
  }

  // New short pack format: "p-{user_token}-{pack_id}-{timestamp}"
  if let Some(rest) = tx_ref.strip_prefix("p-") {
    let mut parts = rest.split('-');
    let user_token = parts.next()?;
    let pack_id = decode_pack_id(parts.next()?)?;
    let ts = parts.next()?;
    if parts.next().is_some() || ts.is_empty() || user_token.is_empty() {
      return None;
    }
    return Some(ChapaTxRefPayload::CreditsPack {
      user_token: user_token.to_string(),
      pack_id,
    });
  }

  // Legacy format support for backwards compatibility: "artcraft-sub-..." or "artcraft-pack-..."
  if let Some(rest) = tx_ref.strip_prefix("artcraft-") {
    let (kind, remainder) = rest.split_once('-')?;
    match kind {
      "sub" => {
        let mut parts = remainder.split('-');
        let user_token = parts.next()?;
        let slug = decode_slug(parts.next()?)?;
        let period = decode_period(parts.next()?)?;
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
        let mut parts = remainder.split('-');
        let user_token = parts.next()?;
        let pack_id = decode_pack_id(parts.next()?)?;
        let nanos = parts.next()?;
        if parts.next().is_some() || nanos.is_empty() || user_token.is_empty() {
          return None;
        }
        if nanos.parse::<i64>().is_err() {
          return None;
        }
        Some(ChapaTxRefPayload::CreditsPack {
          user_token: user_token.to_string(),
          pack_id,
        })
      }
      _ => None,
    }
  } else {
    None
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
      assert!(tx_ref.starts_with("s-u_0123456789abcdefghij-p-y-"));
      assert!(tx_ref.len() <= 50, "tx_ref length {} exceeds 50", tx_ref.len());

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
      assert!(tx_ref.starts_with("p-u_0123456789abcdefghij-500-"));
      assert!(tx_ref.len() <= 50, "tx_ref length {} exceeds 50", tx_ref.len());

      let decoded = ChapaTxRefPayload::from_tx_ref(&tx_ref).unwrap();
      assert_eq!(decoded, payload);
    }

    #[test]
    fn legacy_format_still_decodes() {
      let legacy_sub = "artcraft-sub-u_0123456789abcdefghij-artcraft_pro-yearly-1728825123456789123";
      let decoded_sub = ChapaTxRefPayload::from_tx_ref(legacy_sub).unwrap();
      assert_eq!(
        decoded_sub,
        ChapaTxRefPayload::Subscription {
          user_token: "u_0123456789abcdefghij".to_string(),
          slug: ArtcraftSubscriptionSlug::ArtcraftPro,
          period: EtbSubscriptionBillingPeriod::Yearly,
        }
      );

      let legacy_pack = "artcraft-pack-u_0123456789abcdefghij-etb_500-1728825123456789123";
      let decoded_pack = ChapaTxRefPayload::from_tx_ref(legacy_pack).unwrap();
      assert_eq!(
        decoded_pack,
        ChapaTxRefPayload::CreditsPack {
          user_token: "u_0123456789abcdefghij".to_string(),
          pack_id: "etb_500".to_string(),
        }
      );
    }

    #[test]
    fn every_plan_and_period_round_trips() {
      for slug in ArtcraftSubscriptionSlug::all_variants() {
        for period in [EtbSubscriptionBillingPeriod::Monthly, EtbSubscriptionBillingPeriod::Yearly] {
          let payload = ChapaTxRefPayload::Subscription {
            user_token: "user_6neje6w8f1487".to_string(),
            slug,
            period,
          };
          let tx_ref = payload.to_tx_ref();
          assert!(tx_ref.len() <= 50, "tx_ref length {} exceeds 50 for {:?}", tx_ref.len(), payload);
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
      assert!(ChapaTxRefPayload::from_tx_ref("s-").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("p-").is_none());
    }

    #[test]
    fn rejects_bad_plan_slug_or_period() {
      assert!(ChapaTxRefPayload::from_tx_ref("s-u_abc-not_a_plan-m-123").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("s-u_abc-p-weekly-123").is_none());
    }

    #[test]
    fn rejects_bad_timestamp() {
      assert!(ChapaTxRefPayload::from_tx_ref("s-u_abc-p-m-").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("p-u_abc-500-").is_none());
    }

    #[test]
    fn rejects_extra_fields() {
      assert!(ChapaTxRefPayload::from_tx_ref("p-u_abc-500-123-extra").is_none());
      assert!(ChapaTxRefPayload::from_tx_ref("s-u_abc-p-m-123-extra").is_none());
    }
  }
}
