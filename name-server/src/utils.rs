/*
 *  Copyright (C) 2004-2021 Savoir-faire Linux Inc.
 *
 *  Author: Olivier Dion <olivier.dion@savoirfairelinux.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

pub fn check_addr(addr: String) -> Option<String> {

    // Addresses are 20 bytes long, thus 40 hexadecicmal ascii characters
    if 40 != addr.len() {
        return None
    }

    for c in addr.bytes() {
        match c {
            b'0'..=b'9' | b'a'..=b'f' | b'A'..=b'F' => { }
            _ => return None
        }
    }

    Some(addr)
}

pub fn check_name(name: String) -> Option<String> {

    // TODO - Use command line option
    if 32 < name.as_bytes().len() {
        return None;
    }

    return Some(name)
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_check_addr() {

        let bad_addresses = vec![
            String::from("82e09210c8a8436e9fced3a969ac82bc6c22709"),   // All hexadecmal but missing character
            String::from("82e09210c8a8436e9fced3a969ac82bc6c22709Z"),  // All hexadecimal except last character
            String::from("82e09210c8a8436e9fced3a969ac82bc6c2270955"), // All hexadecimal but extra character
        ];

        for addr in bad_addresses.into_iter() {
            assert_eq!(check_addr(addr), None);
        }

        let good_addresses = vec![
            String::from("82e09210c8a8436e9fced3a969ac82bc6c227095"), // Accept lowercase
            String::from("82E09210C8A8436E9FCED3A969AC82BC6C227095"), // Accept uppercase
            String::from("82e09210C8A8436E9FCeD3a969AC82bC6C227095"), // Accept mixcase
        ];

        for addr in good_addresses.into_iter() {
            assert_ne!(check_addr(addr), None);
        }
    }

    #[test]
    fn test_check_name() {

        let bad_names = vec![
            String::from("Very loooooooooooooooooooong name"), // Name too long
        ];

        for name in bad_names.into_iter() {
            assert_eq!(check_name(name), None);
        }

        let good_names = vec![
            String::from("Name at the limit---------------")
        ];

        for name in good_names.into_iter() {
            assert_ne!(check_name(name), None);
        }
    }

}
