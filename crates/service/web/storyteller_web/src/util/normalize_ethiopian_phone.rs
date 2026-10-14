/// Normalizes an Ethiopian phone number to the standard 10-digit local format
/// (e.g. "0911223344" or "0711223344").
pub fn normalize_ethiopian_phone(input: &str) -> Option<String> {
  let digits: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
  if digits.len() == 10 && (digits.starts_with("09") || digits.starts_with("07")) {
    Some(digits)
  } else if digits.len() == 9 && (digits.starts_with('9') || digits.starts_with('7')) {
    Some(format!("0{}", digits))
  } else if digits.len() == 12 && (digits.starts_with("2519") || digits.starts_with("2517")) {
    Some(format!("0{}", &digits[3..]))
  } else if digits.len() == 10 && digits.starts_with('0') {
    Some(digits)
  } else {
    None
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_normalize_ethiopian_phone() {
    assert_eq!(normalize_ethiopian_phone("0911223344"), Some("0911223344".to_string()));
    assert_eq!(normalize_ethiopian_phone("911223344"), Some("0911223344".to_string()));
    assert_eq!(normalize_ethiopian_phone("+251911223344"), Some("0911223344".to_string()));
    assert_eq!(normalize_ethiopian_phone("251911223344"), Some("0911223344".to_string()));
    assert_eq!(normalize_ethiopian_phone("0711223344"), Some("0711223344".to_string()));
    assert_eq!(normalize_ethiopian_phone("abc"), None);
  }
}
