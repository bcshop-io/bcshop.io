pragma solidity ^0.4.10;

import './Product.sol';
import './VendorBase.sol';

///Vendor-provider agreement with the ability to create products
contract Vendor is VendorBase {

    event ProductCreated(address product, string name, uint256 price);

    /**@dev List of all created products */
    Product[] public products;

    function Vendor(address vendorWallet, address serviceProvider, uint256 feeInPromille) {
        require(vendorWallet != 0x0);        
        require(serviceProvider != 0x0);

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
        managerOnly
        returns (address) 
    {
        //check maximum length
        //require(bytes(name).length <= 255);

        uint256 id = products.length;
        Product product = createProductObject(id, name, unitPriceInWei, isLimited, maxQuantity, allowFractions, purchaseStartTime, purchaseEndTime);
        products.push(product);
        
        ProductCreated(product, name, unitPriceInWei);

        return products[id];
    }

    /**@dev Returns count of products */
    function getProductsCount() constant returns (uint256) {
        return products.length;
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
        managerOnly
        returns (Product)
    {
        return new Product(id, name, unitPriceInWei, isLimited, maxQuantity, allowFractions, purchaseStartTime, purchaseEndTime);
    }
}