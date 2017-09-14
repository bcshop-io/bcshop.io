pragma solidity ^0.4.10;

import './AddressStorageUser.sol';
import '../contracts/shop/NamedVendor.sol';
import '../contracts/shop/Product.sol';

contract TestVendor is AddressStorageUser {

    uint public initialBalance = 1000000000 wei;

    Vendor vendor;
    Product product;

    uint fee = 100;
    uint price = 1000 wei;
    
    function TestVendor() {}

    function() payable {}

    /* Test zero fee */
    // function test1() {
    //     vendor = new Vendor(address3, address2, 0);
    //     product = Product(vendor.createProduct("P1", price, false, 0, false, 0, 0));

    //     uint oldBalance1 = address3.balance;
    //     uint oldBalance2 = address2.balance;
    //     product.buy.value(price)("c1");

    //     Assert.equal(product.soldUnits(), 1, "1");
    //     Assert.equal(address3.balance, oldBalance1 + price, "2");
    //     Assert.equal(address2.balance, oldBalance2, "3");        
    // }

    /* Test non-zero fee, non-limited, non-fractional product */
    function test2() {
        NamedVendor vendor = new NamedVendor("V", address1, address2, fee);
        product = Product(vendor.createProduct("P1", price, false, 0, false, 0, 0));

        uint oldBalance1 = address1.balance;
        uint oldBalance2 = address2.balance;

        product.buy.value(price)("");
        product.buy.value(price + 200 wei)("c1");
        product.buy.value(price + 300 wei)("c2");
        //product.buy.value(price - 100 wei)("c1"); throw invalid opcode

        uint totalPrice = price * 3;
        uint toWithdraw = 500 wei;        

        Assert.equal(product.soldUnits(), 3, "1");
        Assert.equal(address1.balance, oldBalance1 + totalPrice * (1000 - fee) / 1000, "2");
        Assert.equal(address2.balance, oldBalance2 + totalPrice * fee / 1000, "3");
        Assert.equal(product.pendingWithdrawals(this), toWithdraw, "4");

        uint oldBalance4 = this.balance;  

        product.setParams("", 800 wei, false, 1000, false, 1110, 1110, true);
        Assert.equal(product.price(), 800 wei, "new price");

        product.withdrawOverpay();        

        Assert.equal(this.balance, oldBalance4 + toWithdraw, "5");
    }

    /* Test limited, non-fractional product */
    // function test3() {
    //     vendor = new Vendor(address1, address2, fee);
    //     product = Product(vendor.createProduct("P1", price, true, 5, false, 0, 0));

    //     uint oldBalance1 = address1.balance;
    //     uint oldBalance2 = address2.balance;

    //     product.buy.value(price)("");
    //     product.buy.value(price * 3)("");        

    //     Assert.equal(product.soldUnits(), 4, "1");

    //     //product.buy.value(price * 2)(""); //throw invalid opcode
    //     product.buy.value(price)("");

    //     Assert.equal(product.soldUnits(), 5, "1");
    // }        

    /* Test huge string input */
    // function test4() {
        
    //     vendor = new Vendor(address3, address2, 100);

    //     product = Product(vendor.createProduct(
    //         "P1", 
    //         price, false, 0, false, 0, 0));
        
    //     Assert.equal(vendor.getProductsCount(), 1, "0");
    //     //should throw
    //     product.buy.value(price)("P1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsv"); 
    //     Assert.equal(product.soldUnits(), 1, "1");
    // }

    // /* Test huge string input */
    // function test5() {
        
    //     vendor = new Vendor(address3, address2, 100);

    //     //should throw
    //     product = Product(vendor.createProduct(
    //         "P1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsvP1847flksdjfsldfjsldjfsv", 
    //         price, false, 0, false, 0, 0));
        
    //     Assert.equal(vendor.getProductsCount(), 1, "0");
    // }
}