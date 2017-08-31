pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/shop/NamedVendor.sol';
import '../contracts/shop/TokenVendor.sol';

//required migrations
//3_helper_deploy.js
contract TestNamedVendor is AddressStorageUser {
    function TestNamedVendor() {}

    function() payable {}

    function test1() {
         NamedVendor vendor = new NamedVendor("abcdefabcdefabcdefabcdefabcdefab", address1, address2, 0);
         Assert.equal(vendor.name(), "abcdefabcdefabcdefabcdefabcdefab", "1");
    }

    function test2() {
        TokenVendor vendor = new TokenVendor("BONUS", address1, address2, 0);
        Assert.equal(vendor.name(), "BONUS", "2");
    }
}