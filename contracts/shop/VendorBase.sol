pragma solidity ^0.4.10;

import '../common/Manageable.sol';

/// An interface to Vendor object, stored in product as an owner 
contract VendorBase is Manageable {    
    address public vendor;
    address public provider;
    uint256 public providerFeePromille;    
}
