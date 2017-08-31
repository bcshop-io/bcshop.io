pragma solidity ^0.4.10;

import './TokenProduct.sol';
import './NamedVendor.sol';
import '../token/MintableToken.sol';

///Vendor that can sell only token products. Must be a token manager to operate correctly
contract TokenVendor is NamedVendor {

    MintableToken public token;

    function TokenVendor(string vendorName, address vendorWallet, address serviceProvider, uint256 feeInPromille) 
        NamedVendor(vendorName, vendorWallet, serviceProvider, feeInPromille) 
    {
    }

    function setToken(MintableToken tokenToSell) managerOnly {
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
        managerOnly
        returns (Product)
    {
        require (address(token) != 0x0);

        Product p = new TokenProduct(token, id, name, maxQuantity, purchaseStartTime, purchaseEndTime);
        token.setMinter(p, true);
        return p;
    }
}