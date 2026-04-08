program ppv_access.aleo;

constructor:
    assert.eq edition 0u16;

function pay_and_verify:
    input r0 as u32.public;
    input r1 as u32.public;
    gte r0 r1 into r2;
    output r2 as boolean.public;
