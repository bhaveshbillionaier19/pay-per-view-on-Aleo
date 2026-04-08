program ppv_access.aleo {
    transition pay_and_verify(public amount: u32, public minimum_amount: u32) -> bool {
        let is_paid: bool = amount >= minimum_amount;
        return is_paid;
    }
}

