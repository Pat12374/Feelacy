# WineBloom fee rules (source of truth)

## Buyers

Buyers pay only:

1. Displayed product price  
2. Stated shipping  
3. Applicable taxes, excise duties, and customs charges  

Buyers do **not** pay: marketplace commissions, buyer premiums, WineBloom transaction fees, Buy Again fees, search fees, or basic WineBloom AI fees.

## Sellers — subscription + commission

| Plan | Monthly fee | Commission on completed sale (product subtotal) |
|---|---:|---:|
| Starter | €0 | 10% |
| Merchant | €49 | 7% |
| Professional | €149 | 5% |
| Enterprise | from €399 | negotiated 3.5%–4.5% |

Commission is calculated on the **product subtotal**, not on shipping.

## Payment processing (seller-side)

- Deducted from seller proceeds.  
- Disclosed separately from WineBloom commission.  
- Planning estimate: **2.5% + €0.25** per payment.  
- Ledger records the **payment provider’s actual charge** after settlement.

## Settlement identity

```
buyer_charge    = product + shipping + tax_lines
feelacy_fee     = product × plan_commission
processor_fee   = actual provider fee (estimate before capture)
seller_net      = buyer_charge − feelacy_fee − processor_fee (− tax remitted by platform if applicable)
```
