pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

import './AddressStorageUser.sol';
import '../contracts/misc/ErrorVendor.sol';
import '../contracts/shop/Vendor.sol';

//required migrations
//3_helper_deploy.js
contract TestErrorVendor is AddressStorageUser {

    uint public initialBalance = 100000000 wei;
    ErrorVendor errorVendor1;
    HugePayableFunction errorVendor2;
    
    Vendor vendor;
    Product product;

    function TestErrorVendor() {}

    function beforeAll() {
        errorVendor1 = new ErrorVendor();
        errorVendor2 = new HugePayableFunction();
    }

    // function test1() {
        
    //     vendor = new Vendor(errorVendor1, address1, 100);

    //     product = Product(vendor.createProduct("P1", 50, false, 0, false, 0, 0));

    //     product.buy.value(500 wei)("c1"); //this should throw 'invalid opcode'
    //     Assert.isTrue(true, "test error vendor");
    // }

    // function test2() {

    //     uint oldBalance = errorVendor2.balance;
    //     vendor = new Vendor(errorVendor2, address1, 100);
    //     product = Product(vendor.createProduct("P1", 50, false, 0, false, 0, 0));

    //     product.buy.value(500 wei)("c2"); //this should throw 'invalid opcode'
    //     Assert.equal(errorVendor2.balance, oldBalance + 450 wei, "Invalid ether received by vendor");
    //     Assert.isTrue(true, "test huge payable function");        
    // }

    // function test3() {
    //     vendor = new Vendor(this, address1, 100);
    //     product = Product(vendor.createProduct("P1", 50, false, 0, false, 0, 0));
    //     uint oldBalance = this.balance;
    //     product.buy.value(500 wei)("c3"); //this should throw 'invalid opcode'        
    //     Assert.equal(this.balance, oldBalance - 500 wei + 450 wei, "1");
    // }

    //this function tries to call sender buy method again, testing reenter protection
    function () payable {
        Product p1 = Product(msg.sender);
        p1.buy.value(1000 wei)("ERROR");
    }
}