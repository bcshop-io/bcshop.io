const fs = require("fs");

let Token = artifacts.require("BCSToken");
let ProductStorage = artifacts.require("ProductStorage");
let ProductMaker = artifacts.require("ProductMaker");
let DiscountPolicy = artifacts.require("DiscountPolicy");
let ProductPayment = artifacts.require("ProductPayment");
let EtherFund = artifacts.require("EtherFund");

let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let EscrowTime = 3600; //1 hour
let MinPoolForDiscount = OneEther / 1000;
let LevelTokens = [OneEther, 2*OneEther, 3*OneEther];

let expectedCashback1 = 0;
let expectedCashback2 = 0;
let expectedCashback3 = 0;

let token;
let storage;
let payment;
let discountPolicy;
let factory;
let feePool;

//retrieves cashback value from the payment transaction
function getCashbackFromPayment(paymentTx) {    
    return paymentTx.logs[0].args.discount.toNumber();
}

async function buy(pid, units, customer) {
    let price = await storage.getProductPrice.call(pid);
    return await payment.buyWithEth(pid, units, "info", false, price, {from:customer, value:price*units});
}

module.exports = async function(deployer, network, accounts) {

    let Utils = require("../test/utils.js");
    let utils = new Utils(Utils.createWeb3(network));
    let time = new (require("../test/timeutils.js"))(utils._web3);

    let owner = accounts[0];
    let provider = accounts[1];
    let escrow = accounts[2];
    let user1 = accounts[3];
    let user2 = accounts[4];
    let user3 = accounts[9];
    let vendor = accounts[5];    
    
    let config = JSON.parse(fs.readFileSync("./products.json")); 
    
    token = Token.at(config.token.address);
    storage = ProductStorage.at(config.storage.address);
    factory = ProductMaker.at(config.factory.address);    
    discountPolicy = DiscountPolicy.at(config.discountPolicy.address);
    payment = ProductPayment.at(config.payment.address);    
    feePool = EtherFund.at(config.feePool.address);

    await utils.sendEther(owner, feePool.address, MinPoolForDiscount * 2);

    await token.transfer(user1, LevelTokens[0]);
    await token.transfer(user2, LevelTokens[1]);
    await token.transfer(user3, LevelTokens[0] / 2);  

    await discountPolicy.setManager(accounts[8], true);

    //create 1st product - no escrow
    await factory.createSimpleProduct(Price1, 0, true, 0, 0, false, false, "NOESCROW", "EMAIL", {from:vendor});

    //create 2nd product - use escrow
    await factory.createSimpleProduct(Price1, 0, true, 0, 0, true, false, "USEESCROW", "EMAIL", {from:vendor});

    tx = await buy(0, 1, user1);
    expectedCashback1 += getCashbackFromPayment(tx);

    tx = await buy(1, 2, user2); //to cancel

    tx = await buy(0, 1, user2);
    expectedCashback2 += getCashbackFromPayment(tx);

    tx = await buy(0, 1, user1);
    expectedCashback1 += getCashbackFromPayment(tx);

    tx = await buy(1, 1, user1);
    expectedCashback1 += getCashbackFromPayment(tx);

    tx = await buy(1, 1, user1);
    expectedCashback1 += getCashbackFromPayment(tx);
    
    tx = await buy(1, 2, user2);
    expectedCashback2 += getCashbackFromPayment(tx);

    tx = await buy(1, 1, user3); //to cancel
    
    tx = await buy(0, 1, user3);
    expectedCashback3 += getCashbackFromPayment(tx);
        
    await payment.complain(1, 0, {from:user2});
    await payment.complain(1, 1, {from:user1});
    await payment.complain(1, 4, {from:user3});

    //escrow resolves 2 as canceled
    await payment.resolve(1, 0, true, {from:escrow});
    await payment.resolve(1, 4, true, {from:escrow});
    await payment.resolve(1, 1, false, {from:escrow});
        
    await time.timeTravelAndMine(EscrowTime);        

    //make some more payments 
    tx = await buy(0, 1, user1);
    expectedCashback1 += getCashbackFromPayment(tx);

    tx = await buy(1, 2, user2);
    expectedCashback2 += getCashbackFromPayment(tx);
    
    tx = await buy(1, 1, user3);
    tx = await buy(1, 1, user1);
    tx = await buy(1, 1, user2);    

    await payment.complain(1, 5, {from:user2});
    await payment.resolve(1, 5, false, {from:escrow});

    console.log("Cashback for user 1: " + expectedCashback1.toString());
    console.log("Cashback for user 2: " + expectedCashback2.toString());
    console.log("Cashback for user 3: " + expectedCashback3.toString());

    fs.writeFileSync("_cashback1.json",
        JSON.stringify(
        {
            expected: [expectedCashback1, expectedCashback2, expectedCashback3],
            block : utils._web3.eth.blockNumber
        }        
    ));
}