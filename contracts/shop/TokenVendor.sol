pragma solidity ^0.4.10;

import './TokenProduct.sol';
import './Vendor.sol';
import '../token/MintableToken.sol';

///Vendor that can sell only token products. Must be a token manager to operate correctly
contract TokenVendor is Vendor {

    MintableToken public token;

    function TokenVendor(address vendorWallet, address serviceProvider, uint256 feeInPromille) 
        Vendor(vendorWallet, serviceProvider, feeInPromille) {
    }

    function setToken(MintableToken tokenToSell) ownerOnly {
        token = tokenToSell;        
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
        require (address(token) != 0);

        Product p = new TokenProduct(token, id, name, maxQuantity, purchaseStartTime, purchaseEndTime);
        token.setMinter(p, true);
        return p;
    }

}