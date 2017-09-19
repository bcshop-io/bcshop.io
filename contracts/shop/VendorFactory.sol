pragma solidity ^0.4.10;

import './NamedVendor.sol';
import '../common/Manageable.sol';

/// Utilities to create and manage vendors
contract VendorFactory is Manageable {

    event VendorCreated(address vendor, string name);

    ///List of vendors grouped by ots owner
    mapping(address => NamedVendor[]) public vendors; 

    address public provider;
    uint256 public providerFeePromille;

    function VendorFactory(address serviceProvider, uint256 feePromille) {
        provider = serviceProvider;
        providerFeePromille = feePromille;
    }

    /**@dev Creates vendor with specified wallet to receive profit*/
    function createVendor(address vendorWallet, string name) {
        NamedVendor vendor = new NamedVendor(name, vendorWallet, provider, providerFeePromille);
        vendor.transferOwnership(msg.sender);
        vendors[msg.sender].push(vendor);

        VendorCreated(vendor, name);
    }

    /**@dev Returns a number of vendor contracts created by specific owner */
    function getVendorCount(address owner) constant returns (uint256) {
        return vendors[owner].length;
    }

    /**@dev Changes default provider settings */
    function setParams(address newProvider, uint256 newFeePromille) managerOnly {
        provider = newProvider;
        providerFeePromille = newFeePromille;
    }
}