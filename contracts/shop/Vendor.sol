pragma solidity ^0.4.10;

import './Product.sol';
import './VendorBase.sol';

///Vendor-provider agreement with the ability to create products
contract Vendor is VendorBase {

    //for functions that only vendor can call
    //modifier onlyVendor {require(msg.sender == vendor); _;}

    event ProductCreated(address product, string name);
    
    Product[] public products;

    function Vendor(address vendorWallet, address serviceProvider, uint256 feeInPromille) {
        require(vendorWallet != 0x0 && serviceProvider != 0x0);

        vendor = vendorWallet;
        provider = serviceProvider;
        providerFeePromille = feeInPromille;
    }

    /**@dev Create product with specified features */
    function createProduct (
        string name, 
        uint256 unitPriceInWei, 
        bool isLimited, 
        uint256 maxQuantity, 
        bool allowFractions,
        uint256 purchaseStartTime,
        uint256 purchaseEndTime
    )
        ownerOnly
        returns (address) 
    {
        uint256 id = products.length;
        Product product = createProductObject(id, name, unitPriceInWei, isLimited, maxQuantity, allowFractions, purchaseStartTime, purchaseEndTime);
        products.push(product);

        ProductCreated(product, name);

        return products[id];
    }

    function createProductObject(
        uint256 id,
        string name, 
        uint256 unitPriceInWei, 
        bool isLimited, 
        uint256 maxQuantity, 
        bool allowFractions,
        uint256 purchaseStartTime,
        uint256 purchaseEndTime
    )
        internal
        ownerOnly
        returns (Product)
    {
        return new Product(id, name, unitPriceInWei, isLimited, maxQuantity, allowFractions, purchaseStartTime, purchaseEndTime);
    }
}