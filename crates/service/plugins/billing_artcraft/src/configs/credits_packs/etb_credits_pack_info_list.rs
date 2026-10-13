use crate::configs::credits_packs::etb_credits_pack_info::EtbCreditsPackInfo;

//
// 1 ETB = 1 Credit. Larger packs earn bonus credits. These constants are the
// canonical pack definitions; `calculate_credits_for_etb()` mirrors the same
// bonus schedule for arbitrary custom top-up amounts.
//

pub const ETB_100 : EtbCreditsPackInfo = EtbCreditsPackInfo {
  id: "etb_100",
  etb_price: 100,
  credits_awarded: 100,
  bonus_credits: 0,
  badge: None,
};

pub const ETB_300 : EtbCreditsPackInfo = EtbCreditsPackInfo {
  id: "etb_300",
  etb_price: 300,
  credits_awarded: 320,
  bonus_credits: 20,
  badge: None,
};

pub const ETB_500 : EtbCreditsPackInfo = EtbCreditsPackInfo {
  id: "etb_500",
  etb_price: 500,
  credits_awarded: 560,
  bonus_credits: 60,
  badge: Some("Popular"),
};

pub const ETB_1000 : EtbCreditsPackInfo = EtbCreditsPackInfo {
  id: "etb_1000",
  etb_price: 1000,
  credits_awarded: 1200,
  bonus_credits: 200,
  badge: Some("Best Value"),
};

/// Every standard ETB pack, cheapest first.
pub const ETB_CREDITS_PACK_LIST : [EtbCreditsPackInfo; 4] = [
  ETB_100,
  ETB_300,
  ETB_500,
  ETB_1000,
];

pub fn get_etb_credits_pack_by_id(id: &str) -> Option<EtbCreditsPackInfo> {
  if let Some(pack) = ETB_CREDITS_PACK_LIST.iter().find(|pack| pack.id == id).copied() {
    return Some(pack);
  }

  // Support arbitrary custom ETB top-up amounts (e.g. "etb_250", "etb_750", "c_500")
  let clean_id = id
    .strip_prefix("c_")
    .or_else(|| id.strip_prefix("custom_"))
    .or_else(|| id.strip_prefix("etb_"))?;

  if let Ok(amount) = clean_id.parse::<u64>() {
    if amount >= crate::configs::credits_packs::calculate_credits_for_etb::MINIMUM_CUSTOM_ETB_TOP_UP {
      let credits_awarded = crate::configs::credits_packs::calculate_credits_for_etb::calculate_credits_for_etb(amount);
      let bonus_credits = credits_awarded.saturating_sub(amount);
      return Some(EtbCreditsPackInfo {
        id: Box::leak(id.to_string().into_boxed_str()),
        etb_price: amount,
        credits_awarded,
        bonus_credits,
        badge: None,
      });
    }
  }

  None
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::configs::credits_packs::calculate_credits_for_etb::calculate_credits_for_etb;

  mod list_checks {
    use super::*;

    #[test]
    fn lookup_round_trips_every_pack_id() {
      for pack in ETB_CREDITS_PACK_LIST {
        assert_eq!(get_etb_credits_pack_by_id(pack.id), Some(pack));
      }
    }

    #[test]
    fn lookup_misses_unknown_ids() {
      assert_eq!(get_etb_credits_pack_by_id("etb_unknown"), None);
      assert_eq!(get_etb_credits_pack_by_id("etb_10"), None); // below MINIMUM_CUSTOM_ETB_TOP_UP (50)
      assert_eq!(get_etb_credits_pack_by_id("artcraft_1000"), None);
      assert_eq!(get_etb_credits_pack_by_id(""), None);
      // Valid custom amount resolves dynamically
      assert!(get_etb_credits_pack_by_id("etb_999").is_some());
    }

    #[test]
    fn pack_ids_are_unique() {
      let mut ids : Vec<&str> = ETB_CREDITS_PACK_LIST.iter().map(|pack| pack.id).collect();
      ids.sort_unstable();
      ids.dedup();
      assert_eq!(ids.len(), ETB_CREDITS_PACK_LIST.len());
    }
  }

  mod math_checks {
    use super::*;

    #[test]
    fn credits_awarded_equals_base_plus_bonus() {
      for pack in ETB_CREDITS_PACK_LIST {
        assert_eq!(
          pack.credits_awarded,
          pack.etb_price + pack.bonus_credits,
          "pack {} is internally inconsistent",
          pack.id
        );
      }
    }

    #[test]
    fn bonus_schedule_matches_calculate_credits_for_etb() {
      for pack in ETB_CREDITS_PACK_LIST {
        assert_eq!(
          calculate_credits_for_etb(pack.etb_price),
          pack.credits_awarded,
          "pack {} diverges from the dynamic bonus schedule",
          pack.id
        );
      }
    }
  }
}
