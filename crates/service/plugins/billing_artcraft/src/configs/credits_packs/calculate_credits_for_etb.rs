/// Minimum custom top-up amount, in ETB
pub const MINIMUM_CUSTOM_ETB_TOP_UP : u64 = 50;

/// Credits granted for an arbitrary ETB top-up under the "1 ETB = 1 Credit"
/// pricing model, including the tiered bonus schedule:
///
/// - Below 300 ETB: no bonus (1:1)
/// - 300–499 ETB: ~+6.7% bonus (amount + amount / 15)
/// - 500–999 ETB: +12% bonus (amount + amount * 3 / 25)
/// - 1000+ ETB: +20% bonus (amount + amount / 5)
///
/// NB: The integer-friendly ratios reproduce the standard packs exactly at
/// their anchor amounts: 300 → 320, 500 → 560, 1000 → 1200.
pub fn calculate_credits_for_etb(amount_etb: u64) -> u64 {
  if amount_etb >= 1000 {
    amount_etb + (amount_etb / 5)
  } else if amount_etb >= 500 {
    amount_etb + (amount_etb * 3 / 25)
  } else if amount_etb >= 300 {
    amount_etb + (amount_etb / 15)
  } else {
    amount_etb
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  mod anchor_checks {
    use super::*;

    #[test]
    fn standard_packs_reproduce_their_advertised_amounts() {
      assert_eq!(calculate_credits_for_etb(100), 100);
      assert_eq!(calculate_credits_for_etb(300), 320);
      assert_eq!(calculate_credits_for_etb(500), 560);
      assert_eq!(calculate_credits_for_etb(1000), 1200);
    }
  }

  mod boundary_checks {
    use super::*;

    #[test]
    fn below_300_etb_is_1_to_1() {
      assert_eq!(calculate_credits_for_etb(MINIMUM_CUSTOM_ETB_TOP_UP), 50);
      assert_eq!(calculate_credits_for_etb(299), 299);
    }

    #[test]
    fn tier_just_below_its_lower_edge_stays_in_the_lower_tier() {
      assert_eq!(calculate_credits_for_etb(499), 499 + (499 / 15));
      assert_eq!(calculate_credits_for_etb(999), 999 + (999 * 3 / 25));
    }

    #[test]
    fn zero_and_one_are_1_to_1() {
      assert_eq!(calculate_credits_for_etb(0), 0);
      assert_eq!(calculate_credits_for_etb(1), 1);
    }
  }
}
