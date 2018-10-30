pragma solidity ^0.4.24;

import "../common/IOwned.sol";

contract IVendorManager {
    /**@dev Returns true if it is valid factory for creation */
    function validFactory(address factory) public view returns (bool) {factory;}

    /**@dev Returns true if it allows creation operations */
    function active() public view returns (bool) {}

    /**@dev Returns provider wallet address */
    function provider() public view returns (address) {}

    /**@dev Retursn default fee to provider */
    function providerFeePromille() public view returns (uint256) {}

    /**@dev Returns true if vendor contract was created by factory */
    function validVendor(address vendor) public view returns(bool) {vendor;}

    /**@dev Adds new vendor to storage */
    function addVendor(address vendorOwner, address vendor) public;
}