# About
This repository contains smart contracts of [BCShop.io](https://bcshop.io) - Ethereum-based marketplace for services and digital goods

# Folder structure
Standard **truffle** folder structure. 
- **contracts\product** - main folder for smart contracts of the current version;
- **contracts\token** - contracts of BCS token;
- **contracts\shop** - contracts for previous version of BCShop.io. Most of them are now deprecated;
- **contracts\crowdsale** - contracs for past crowdsale along with lockable token pools;
- **contracts\common** - general purpose smart contracts.

# Contracts details
This figure shows contracts' relation. Light rectangles are interfaces, dark ones are implementations.  

![Contracts relations](https://i.imgur.com/cDT234j.png)
- **ProductStorage** - Storage of products (and services) data. Contains restricted access functions for manipulating the storage. **IProductStorage** - interface of storage functions.
- **ProductMaker** - Product's factory. Contains functions able to add or edit a product along with additional validation logic. Functions are accessible by end user.
- **ProductPayment** - Payment handler. Contains functions for making a payment for product, and manipulating the purchase. Uses IFeePolicy and IDiscountPolicy for getting cashback and fee discount information. Functions are accessible by end users.
- **IDiscountPolicy** - Cashback calculations and withdraw rules. 
- **DiscountPolicy** - Calculates cashback based on customer's BCS tokens amount. Transfers cashback amount from the discount pool represented by IWallet interface.
- **IFeePolicy** - Fee calculation rules. 
- **FeePolicy** - Calcultes merchant's fee and applies fee discount basing on merchant's BCS tokens amount. Transfers fee to the IFund contract.
- **IFund** - An abstraction of contract which is able to store Ether and divide it between several shareholders.
- **EtherFund** - Divides incoming Ether between discount pool and platform's profit pool.
- **IWallet** - Interface of contract able to store a currency (Ether or tokens) and withdraw it.
- **ProxyFund** - *Proxy* fund contract that has access to another **IFund** contract and can withdraw its share. In BCShop it represents the discount pool.  
- **AffiliateStorage** - Storage for affiliate-related information. **IAffiliateStorage** - its interface.
- **EscrowStorage** - Storage for information about product-escrow relations and general information about escrows: fee, active or not, etc. **IEscrowStorage** - its interface.
- **Escrow** - Contract for end user interactions. Allows to register as escrow and change their own fees. **IEscrow** - its interface.
- **RevokedStorage** - stores purchases revoked by merchants along with escrow fee paid during the payment. **IRevokedStorage** - its interface

# License
MIT License

Copyright (c) [2017-2019] [BCSHOP.IO PTE. LTD]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
