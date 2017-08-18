pragma solidity ^0.4.10;

import './Vendor.sol';

/// Utilities to create and manage vendors
contract VendorFactory {

    mapping(address => Vendor[]) public vendors; 

    address public provider;
    uint256 public providerFeePromille;

    function VendorFactory(address serviceProvider, uint256 feePromille) {
        provider = serviceProvider;
        providerFeePromille = feePromille;
    }

    /**@dev Creates vendor with specified wallet to receive profit*/
    function createVendor(address vendorWallet) {
        Vendor vendor = new Vendor(vendorWallet, provider, providerFeePromille);
        vendor.transferOwnership(msg.sender);
        vendors[msg.sender].push(vendor);
    }
}