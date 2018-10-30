let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let time = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

let storage;
let affStorage;
let escrowStorage;
let escrowProvider;
let feePolicy;
let etherPriceProvider;
let payment;
let discountPolicy;
let etherFund;
let pool;
let token;
let factory;
let gasPrice = 1000000;

let owner;
let provider;
let escrow;
let user1;
let user2;
let bancorOwner;

let WeisForCent = 10000000000000;
let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let ProfitPermille = 200;
let DiscountPermille = 800;
let MinPoolForDiscount = OneEther / 1000;
let DiscountsInPool = 10;
let MaxDiscount = 50; //=5%
const E18 = 1000000000000000000;
const LevelTokens = [E18, 2*E18, 3*E18]; 
const LevelPcts = [100, 200, 300];


let MinTokensForFeeDiscount = 10000000000000000000; //10 bcs
let FeePermille = 100;
let EscrowFeePermille = 50;
let AffiliateFeePermille = 300;
let FeeDiscountTerm = 86400; //1 day
let MaxTotalDiscountPerToken = utils.toWei(0.1);
let FeeDiscountPermille = 600;

let bancorConverter;
let escrowTime = 3600; //1 hour

async function prepare(accounts) {
    users = utils.makeRoles(accounts);

    owner = users.owner;
    provider = users.provider;
    escrow = users.escrow;
    user1 = users.user1;
    user2 = users.user2;
    vendor = users.vendor;
    vendorWallet = accounts[6];
    bancorOwner = accounts[7];
    bancorConverter = accounts[9];

    token = await utils.createToken();
    let result = await utils.createFunds(provider, ProfitPermille);
    pool = result.proxy;
    etherFund = result.fund;
    discountPolicy = await utils.createDiscountPolicy(MinPoolForDiscount, DiscountsInPool, MaxDiscount, pool, token, LevelTokens, LevelPcts);
    
    storage = await utils.createProductStorage();
    affStorage = await utils.createAffiliateStorage();
    escrowStorage = await utils.createEscrowStorage(owner, EscrowFeePermille);
    escrowProvider = await utils.createEscrowProvider(escrowStorage, owner, escrowTime, EscrowFeePermille);

    factory = await utils.createProductFactory(storage, affStorage, escrowStorage);
    etherPriceProvider = await utils.createEtherPriceProvider(WeisForCent); //1 eth = 1000$    
    feePolicy = await utils.createFeePolicy(
        storage, affStorage, escrowProvider, FeePermille, AffiliateFeePermille, etherFund.address, token,
        MinTokensForFeeDiscount, FeeDiscountTerm, MaxTotalDiscountPerToken, FeeDiscountPermille
    );
    payment = await utils.createPayment(storage, escrowProvider, feePolicy, discountPolicy, token, etherPriceProvider);
}

async function createProduct(options = {}) {
    options.price = utils.or(options.price, Price1);
    options.maxUnits = utils.or(options.maxUnits, 0);

    await utils.createProduct(factory, users, options);
    //  factory.createSimpleProduct(
    //     utils.or(options.price, Price1),
    //     utils.or(options.maxUnits, 0),
    //     utils.or(options.isActive, true),
    //     utils.or(options.startTime, 0),
    //     utils.or(options.endTime, 0),
    //     utils.or(options.useEscrow, false),
    //     utils.or(options.useFiatPrice, false),
    //     utils.or(options.name, "Name"),
    //     utils.or(options.data, "Email"),
    //     {from:vendor});
}

async function checkStatus(status) {
    assert.equal((await storage.getPurchase(0, 0)).toNumber(), status, "Invalid status");
}

async function buy(options) {
    let price = await storage.getProductPrice.call(0);

    let units = utils.or(options.units, 1);
    let acceptLess = utils.or(options.acceptLess, false);
    let currentPrice = utils.or(options.currentPrice, price);
    let eth = utils.or(options.eth, price*units);
    let customer = utils.or(options.customer, user2);
    let productId = utils.or(options.productId, 0);

    return (await payment.buyWithEth(productId, units, "id", acceptLess, currentPrice, {from:customer, value:eth, gasPrice:gasPrice}));
}

async function checkEmptyPaymentContract() {
    assert.equal(
        (await utils.getBalance(payment.address)).toNumber(),
        0,
        "Invalid escrow contract balance"
    );
}

contract("ProductPayment. Set parameters", function(accounts) {    
    before(async function() {
        await prepare(accounts);
    });

    it("check parameters after creation", async function() {        
        assert.isTrue(await payment.activeState.call(), "Should be active");
        assert.equal(storage.address, await payment.productStorage.call(), "Invalid storage");
        assert.equal(escrowProvider.address, await payment.escrowProvider.call(), "Invalid escrow provider");
        assert.equal(feePolicy.address, await payment.feePolicy.call(), "Invalid fee policy");
        assert.equal(discountPolicy.address, await payment.discountPolicy.call(), "Invalid discount policy");
        assert.equal(token.address, await payment.token.call(), "Invalid token");
        assert.equal(etherPriceProvider.address, await payment.etherPriceProvider.call(), "Invalid ether price provider");        
    });

    it("can't call setParams as not owner", async function() {
        await utils.expectContractException(async function() {
            await payment.setParams(accounts[0], accounts[5], accounts[1], accounts[2], accounts[3], accounts[4], {from:user1});
        });
    })

    it("check parameters after setParams", async function() {
        await payment.setParams(accounts[0], accounts[5], accounts[1], accounts[2], accounts[3], accounts[4]);

        assert.equal(accounts[0], await payment.productStorage.call(), "Invalid storage");
        assert.equal(accounts[5], await payment.escrowProvider.call(), "Invalid escrow provider");
        assert.equal(accounts[1], await payment.feePolicy.call(), "Invalid fee policy");
        assert.equal(accounts[2], await payment.discountPolicy.call(), "Invalid discount policy");
        assert.equal(accounts[3], await payment.token.call(), "Invalid token");
        assert.equal(accounts[4], await payment.etherPriceProvider.call(), "Invalid ether price provider");
    });
});


contract("ProductPayment. buyWithEth", function(accounts) {
    users = utils.makeRoles(accounts);
    async function testBuy(exception, comment, options, doPreparations = null) {
        it(comment, async function() {
            await createProduct(options);

            if(doPreparations != null) {
                doPreparations(options);
            }

            if(exception) {
                await utils.expectContractException(async function() {
                    await buy(options);
                });
            } else {
                await buy(options);

                let data = await storage.getProductData.call(0);
                assert.equal(data[2].toNumber(), utils.or(options.expectedSold, 1), "Invalid sold units");
            }
        });
    }

    beforeEach(async function() {
        await prepare(accounts);
    });

    it("can't buy if payment contract is inactive", async function() {
        await createProduct();
        await payment.setActive(false);
        await utils.expectContractException(async function() {
            buyTx = await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});
        });
    });

    it("check payment to default vendor wallet", async function() {
        await createProduct();
        let vendorData = await storage.vendors.call(vendor);
        assert.equal(
            vendorData[0],
            "0x0000000000000000000000000000000000000000",
            "Default vendor address is 0x0");
        assert.equal(await storage.getVendorWallet.call(vendor), vendor, "getVendorWallet should be equal to vendor address");

        let oldBalance = await utils.getBalance(vendor);
        buyTx = await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});
        let newBalance = await utils.getBalance(vendor);

        assert.equal(
            oldBalance.plus(utils.dpm(Price1, FeePermille)).toNumber(),
            newBalance.toNumber(),
            "Invalid vendor's balance");
    });

    it("verifies data in the purchase event after payment", async function() {
        await createProduct({price:Price1});
        await token.transfer(user2, LevelTokens[0], {from:owner});
        await utils.sendEther(owner, pool.address, MinPoolForDiscount);

        buyTx = await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});

        assert.equal(buyTx.logs[0].args.buyer, user2, "Invalid customer");
        assert.equal(buyTx.logs[0].args.vendor, vendor, "Invalid vendor");
        assert.equal(buyTx.logs[0].args.productId, 0, "Invalid product id");
        assert.equal(buyTx.logs[0].args.purchaseId, 0, "Invalid purchase id");
        assert.equal(buyTx.logs[0].args.clientId, "id", "Invalid client id");
        assert.equal(buyTx.logs[0].args.price.toNumber(), Price1, "Invalid price");
        assert.equal(buyTx.logs[0].args.paidUnits.toNumber(), 1, "Invalid paid units");
        assert.equal(buyTx.logs[0].args.discount.toNumber(), MinPoolForDiscount/DiscountsInPool, "Invalid discount");
    });

    testBuy(true,
        "can't buy if startTime is greater than now",
        {startTime: time.currentTime() + 1000}
    );

    testBuy(true,
        "can't buy if endTime is less than now",
        {endTime: time.currentTime() - 1000}
    );

    testBuy(true,
        "can't buy if now is not within [startTime, endTime] range",
        {startTime: time.currentTime() + 1000, endTime: time.currentTime() + 10000}
    );

    testBuy(false,
       "can buy if now is within [startTime, endTime] range",
       {startTime: time.currentTime() - 1000, endTime: time.currentTime() + 10000}
    );

    testBuy(true,
       "can't buy if current price doesn't match product's price",
       {price: 100000, currentPrice: 10000}
    );

    testBuy(true,
        "can't buy if product is banned",
        {},
        async function() {
            await storage.banProduct(0, true);
        }
    );

    testBuy(true,
        "can't buy if none left, maxUnits > 0",
        {maxUnits: 1},
        async function(options) {
            await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});
        }
    );

    testBuy(true,
        "can't buy if less than needed left, acceptLess = false",
        {maxUnits: 2, acceptLess: false, units:2},
        async function(options) {
            await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});
        }
    );

    testBuy(false,
        "can buy if less than needed left, acceptLess = true",
        {maxUnits: 2, acceptLess: true, units:2, expectedSold: 2},
        async function(options) {
            await payment.buyWithEth(0, 1, "id", false, Price1, {from:user2, value:Price1});
        }
    );

    testBuy(true,
        "can't buy if isActive = false",
        {isActive:false}
    );

    testBuy(true,
        "can't buy if there is not enough ETH",
        {eth:Price1/2}
    );

    it("can't buy if product id is invalid", async function() {
        await createProduct();
        await utils.expectContractException(async function() {
            await payment.buyWithEth(1,1, "id",true, Price1, {from:user2, value:Price1});
        });
    });
});


contract("ProductPayment. Payment distribution. no escrow, no aff. default vendor wallet. ", function(accounts) {
    let tx;
    
    beforeEach(async function() {
        await prepare(accounts);
    });

    async function checkBalancesAfterPurchase(
        unitsToBuy,
        acceptLess,
        expectedVendorChange,
        expectedCustomerChange,
        expectedUnitsSold,
        ethSent=unitsToBuy*Price1
    ) {
        let oldVendorBalance = await utils.getBalance(vendor);
        let oldCustomerBalance = await utils.getBalance(user1);

        tx = await payment.buyWithEth(
            0, unitsToBuy, "", acceptLess, Price1,
            {from:user1, value:ethSent, gasPrice:gasPrice});
        console.log("Purchase Gas used: " + tx.receipt.gasUsed);
        let customerBalance = await utils.getBalance(user1);
        let vendorBalance = await utils.getBalance(vendor);

        let data = await storage.getProductData.call(0);
        assert.equal(data[2], expectedUnitsSold, "Invalid sold units");

        assert.equal(
            oldVendorBalance.plus(expectedVendorChange).toNumber(),
            vendorBalance.toNumber(),
            "invalid vendor balance"
        );

        assert.equal(
            oldCustomerBalance.minus(tx.receipt.gasUsed*gasPrice).minus(expectedCustomerChange).toNumber(),
            customerBalance.toNumber(),
            "Invalid customer balance"
        );
    }

    it("purchase of 2 units of product", async function() {
        await createProduct();
        await checkBalancesAfterPurchase(2, false, utils.dpm(2 * Price1, FeePermille), 2*Price1, 2);
    });

    it("purchase of 1 units of product, excess eth sent, returned back", async function() {
        await createProduct();
        await checkBalancesAfterPurchase(1, false, utils.dpm(Price1, FeePermille), Price1, 1, Price1*3);
    });

    it("purchase of 2 units when max is 1, acceptLess is true, change should be returned", async function() {
        await createProduct({maxUnits:1});
        await checkBalancesAfterPurchase(2, true, utils.dpm(Price1, FeePermille), Price1, 1);
    });

    it("purchase of 1 unit with customer's discount", async function() {
        await createProduct();
        let fundInitialBalance = MinPoolForDiscount * 2;
        await utils.sendEther(owner, etherFund.address, fundInitialBalance);
        await token.transfer(user1, LevelTokens[0]);

        let expectedDiscount = utils.dpm(fundInitialBalance, ProfitPermille) / DiscountsInPool;
        await checkBalancesAfterPurchase(
            1,
            true, 
            utils.dpm(Price1, FeePermille), 
            Price1, 
            1
        );

        //after the purchase 20% of initial balance should still be there + fee from the purchase
        let fundBalance = await utils.getBalance(etherFund.address);
        assert.equal(
            fundBalance.toNumber(),
            utils.pm(fundInitialBalance, ProfitPermille) + utils.pm(Price1, FeePermille),
            "Invalid fee fund balance");

        //discount pool should have available funds = 80% of initial - discount + 80 of new fee
        assert.equal(
            (await pool.getBalance.call()).toNumber(),
            utils.dpm(fundInitialBalance + utils.pm(Price1, FeePermille), ProfitPermille) - expectedDiscount,
            "Invalid discount pool available funds");        
        assert.equal(
            tx.logs[0].args.discount,
            expectedDiscount,
            "Invalid cashback accumulated"
        );
    });

    it("purchase of 1 unit with fee discount", async function() {
        await token.transfer(vendor, MinTokensForFeeDiscount);
        await createProduct();

        let expectedFeePermille = utils.dpm(FeePermille, FeeDiscountPermille);
        await checkBalancesAfterPurchase(1, true, utils.dpm(Price1, expectedFeePermille), Price1, 1);

        assert.equal(
            (await utils.getBalance(etherFund.address)).toNumber(),
            utils.pm(Price1, expectedFeePermille),
            "Invalid fee fund balance");
    });
});

contract("ProductPayment. Payment distribution. use escrow", function(accounts) {
    beforeEach(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
    });

    let tx;

    async function createEscrowProduct(options = {}) {
        options.useEscrow = true;
        options.escrow = escrow;
        options.escrowTime = 10000;

        await createProduct(options);
    } 

    async function checkBalancesAfterPurchase(
        unitsToBuy,
        acceptLess,
        expectedPayment,
        expectedCustomerChange,
        expectedUnitsSold,
        expectedBaseFee = utils.pm(expectedPayment, FeePermille),
        expectedEscrowFee = utils.pm(expectedPayment, EscrowFeePermille)
    ) {
        let oldVendorBalance = await utils.getBalance(vendor);
        let oldCustomerBalance = await utils.getBalance(user1);
        let oldEscrowBalance = await utils.getBalance(escrow);
        
        let price = await storage.getProductPrice.call(0);

        tx = await payment.buyWithEth(
            0, unitsToBuy, "", acceptLess, price,
            {from:user1, value:price*unitsToBuy, gasPrice:gasPrice});

        console.log("Purchase Gas used: " + tx.receipt.gasUsed);

        let customerBalance = await utils.getBalance(user1);
        let vendorBalance = await utils.getBalance(vendor);
        let escrowBalance = await utils.getBalance(escrow);
        
        let data = await storage.getProductData.call(0);
        assert.equal(data[2], expectedUnitsSold, "Invalid sold units");

        assert.equal(oldVendorBalance.toNumber(), vendorBalance.toNumber(), "Invalid vendor balance");

        assert.equal(
            oldCustomerBalance.minus(tx.receipt.gasUsed*gasPrice).minus(expectedCustomerChange).toNumber(),
            customerBalance.toNumber(),
            "Invalid customer balance"
        );

        assert.equal(
            oldEscrowBalance.plus(expectedEscrowFee).toNumber(),
            escrowBalance.toNumber(),
            "Invaldi escrow balance"
        );

        assert.equal(
            (await utils.getBalance(payment.address)).plus(expectedEscrowFee).toNumber(),
            expectedPayment,
            "Invalid payment received"
        );

        let escrowData = await storage.getEscrowData.call(0, 0);

        assert.equal(escrowData[0], user1, "Invalid customer");
        assert.equal(escrowData[1].toNumber(), expectedBaseFee, "Invalid fee");
        assert.equal(escrowData[2].toNumber(), expectedPayment-expectedBaseFee-expectedEscrowFee, "Invalid profit");
    }

    it("purchase of 2 units of product", async function() {
        await createEscrowProduct();

        await checkBalancesAfterPurchase(2, false, 2*Price1, 2*Price1, 2);
    });

    it("purchase of 3 units when max is 1, acceptLess is true, change should be returned", async function() {
        await createEscrowProduct({maxUnits:1});
        await checkBalancesAfterPurchase(3, true, Price1, Price1, 1);
    });

    it("purchase of 1 unit with customer's discount", async function() {
        await createEscrowProduct();
        let fundInitialBalance = MinPoolForDiscount * 2;
        await utils.sendEther(owner, etherFund.address, fundInitialBalance);
        await token.transfer(user1, LevelTokens[0]);

        let expectedDiscount = utils.dpm(fundInitialBalance, ProfitPermille) / DiscountsInPool;
        await checkBalancesAfterPurchase(
            1, 
            true, 
            Price1, 
            Price1,
            1
        );

        //after the purchase 20% of initial balance should still be there
        let fundBalance = await utils.getBalance(etherFund.address);
        assert.equal(
            fundBalance.toNumber(),
            utils.pm(fundInitialBalance, ProfitPermille),
            "Invalid fee fund balance");

        //discount pool should have available funds = 80% of initial - discount
        assert.equal(
            (await pool.getBalance.call()).toNumber(),
            utils.dpm(fundInitialBalance, ProfitPermille) - expectedDiscount,
            "Invalid discount pool available funds");

        assert.equal(
            tx.logs[0].args.discount,
            expectedDiscount,
            "Invalid cashback accumulated"
        );
    });

    it("purchase of 1 unit with fee discount", async function() {
        await token.transfer(vendor, MinTokensForFeeDiscount);
        await createEscrowProduct();

        let expectedFeePermille = utils.dpm(FeePermille, FeeDiscountPermille); //10% * 60% = 6%
        let expectedEscorwFeePermille = utils.dpm(EscrowFeePermille, FeeDiscountPermille); //5% * 60% = 3%
        await checkBalancesAfterPurchase(
            1, 
            true, 
            Price1, 
            Price1, 
            1, 
            utils.pm(Price1, expectedFeePermille), 
            utils.pm(Price1, expectedEscorwFeePermille)
        );

        assert.equal(
            (await utils.getBalance(etherFund.address)).toNumber(),
            0,
            "Invalid fee fund balance");
    });
});

contract("ProductPayment. Purchase statuses. no escrow", function(accounts) {
    before(async function() {
        await prepare(accounts);
        await createProduct({useEscrow:false});
    });

    it("Status should be Finished after the payment", async function() {
        await payment.buyWithEth(0, 1, "", false, Price1, {from:user1, value:Price1});
        var status = await storage.getPurchase(0, 0);
        assert.equal(status, 0, "Invalid state");
    });
});

contract("ProductPayment. Purchase statuses. use escrow", function(accounts) {
    beforeEach(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow:escrow, escrowTime: escrowTime});
        await payment.buyWithEth(0, 1, "", false, Price1, {from:user1, value:Price1});
    });

    it("status should be Paid right after the purchase", async function() {
        await checkStatus(1);
    });

    it("status should be Complain after the complain", async function() {
        let tx = await payment.complain(0, 0, {from:user1});
        await checkStatus(2);

        let event = tx.logs[0];
        assert.equal(event.event, "ComplainMade", "Invalid event name");
        assert.equal(event.args.vendor, users.vendor, "Invalid event parameter 1");
        assert.equal(event.args.customer, user1, "Invalid event parameter 2");
        assert.equal(event.args.productId, 0, "Invalid event parameter 3");
        assert.equal(event.args.purchaseId, 0, "Invalid event parameter 4");
    });

    it("status should be Canceled after escrow takes customer's side", async function() {
        await payment.complain(0, 0, {from:user1});
        let tx = await payment.resolve(0, 0, true, {from:escrow});
        await checkStatus(3);

        //check event emitted
        let event = tx.logs[0];        
        assert.equal(event.event, "DisputeResolved", "Invalid event name");
        assert.equal(event.args.escrow, escrow, "Invalid event argument 1");
        assert.equal(event.args.purchaseCanceled, 1, "Invalid event argument 2");
        assert.equal(event.args.productId, 0, "Invalid event argument 3");
        assert.equal(event.args.purchaseId, 0, "Invalid event argument 4");
    });

    it("status should be Pending after escrow takes vendor's side", async function() {
        await payment.complain(0, 0, {from:user1});
        let tx = await payment.resolve(0, 0, false, {from:escrow});
        await checkStatus(4);

        //check event emitted
        let event = tx.logs[0];        
        assert.equal(event.event, "DisputeResolved", "Invalid event name");
        assert.equal(event.args.escrow, escrow, "Invalid event argument 1");
        assert.equal(event.args.purchaseCanceled, 0, "Invalid event argument 2");
        assert.equal(event.args.productId, 0, "Invalid event argument 3");
        assert.equal(event.args.purchaseId, 0, "Invalid event argument 4");
    });

    it("status should be Finished after escrow takes vendor's side and vendor gets money", async function() {
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, false, {from:escrow});        
        await payment.withdrawPendingPayments([0], [0], {from:vendor});
        await checkStatus(0);
    });

    it("status should be Paid if the time for complain expires", async function() {
        await time.timeTravelAndMine(escrowTime);
        await checkStatus(1);
    });

    it("status should be Finished if the time for complain expires and vendor gets money", async function() {
        await time.timeTravelAndMine(escrowTime);
        /*
        console.log(await payment.canWithdrawPending.call(0, 0));
        console.log(await storage.getProductOwner.call(0));
        console.log(vendor);
        console.log(await storage.getEscrowData.call(0, 0));        
        console.log(await utils.getBalance(payment.address));
        */
        await payment.withdrawPendingPayments([0], [0], {from:vendor});
        await checkStatus(0);
    });

    it("can resolve complain even after complain time expires", async function() {
        await payment.complain(0, 0, {from:user1});
        await time.timeTravelAndMine(escrowTime*2);
        await payment.resolve(0, 0, false, {from:escrow});
        await payment.withdrawPendingPayments([0], [0], {from:vendor});
        await checkStatus(0);
    });

    it("can cancel complained payment even after complain time expires", async function() {
        await payment.complain(0, 0, {from:user1});
        await time.timeTravelAndMine(escrowTime*2);
        await payment.resolve(0, 0, true, {from:escrow});
        await checkStatus(3);
    });
});

contract("ProductPayment. Escrow use cases", function(accounts) {
    let buyTx;

    beforeEach(async function() {
        await prepare(accounts);
        await storage.setVendorInfo(vendor, vendorWallet, 0);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow:escrow, escrowTime:escrowTime});
        buyTx = await payment.buyWithEth(0, 1, "", false, Price1, {from:user1, value:Price1, gasPrice:gasPrice});
    });

    it("verifies escrow data in storage, purchase event after payment", async function() {
        let data = await storage.getEscrowData.call(0,0);
        assert.equal(data[0], user1, "Invalid customer");
        assert.equal(data[1].toNumber(), utils.pm(Price1, FeePermille), "Invalid fee");
        assert.equal(data[2].toNumber(), utils.dpm(Price1, FeePermille + EscrowFeePermille), "Invalid profit");
        assert.equal(data[3], time.currentTime(), "invalid time");

        assert.equal(buyTx.logs[0].args.buyer, user1, "Invalid customer");
        assert.equal(buyTx.logs[0].args.price.toNumber(), Price1, "Invalid price");
        assert.equal(buyTx.logs[0].args.paidUnits.toNumber(), 1, "Invalid paid units");
    });

    it("withdraw payment after complain time expires, check fee and profit", async function() {
        await time.timeTravelAndMine(escrowTime);
        assert.isTrue(await payment.canWithdrawPending.call(0,0), "should be true");

        let oldVendorBalance = await utils.getBalance(vendorWallet);
        let data = await storage.getEscrowData.call(0, 0);
        await payment.withdrawPendingPayments([0], [0], {from:vendor});

        await checkEmptyPaymentContract();

        assert.equal(
            (await utils.getBalance(vendorWallet)).toNumber(),
            (oldVendorBalance.plus(data[2])).toNumber(),
            "Invalid vendor balance"
        );
    });


    it("try withdraw payment before complain time expires, should fail", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        assert.isFalse(await payment.canWithdrawPending.call(0,0), "should be false");
        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0], [0], {from:vendor});
        });
    });

    it("complain before time expires, check status", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0,0,{from:user1});
        checkStatus(2);
    });

    it("withdraw payment after dispute is won", async function() {
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, false, {from:escrow});
        assert.isTrue(await payment.canWithdrawPending.call(0,0), "should be true");

        let oldVendorBalance = await utils.getBalance(vendorWallet);
        let data = await storage.getEscrowData.call(0, 0);

        await payment.withdrawPendingPayments([0], [0], {from:vendor});

        await checkEmptyPaymentContract();

        assert.equal(
            (await utils.getBalance(vendorWallet)).toNumber(),
            (oldVendorBalance.plus(data[2])).toNumber(),
            "Invalid vendor balance"
        );
    });

    it("try withdraw payment after dispute is lost, should fail", async function() {
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, true, {from:escrow});
        assert.isFalse(await payment.canWithdrawPending.call(0,0), "should be false");

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0], [0], {from:vendor});
        });
    });

    it("try withdraw payment if not vendor, should fail", async function() {
        await time.timeTravelAndMine(escrowTime);
        assert.isTrue(await payment.canWithdrawPending.call(0,0), "should be true");

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0], [0], {from:user2});
        });
    });

    it("can't withdraw if payment contract is inactive", async function() {
        await time.timeTravelAndMine(escrowTime);

        await payment.setActive(false);
        assert.isFalse(await payment.activeState.call(), "Contract should be inactive");

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0], [0], {from:vendor});
        });
    });

    it("can't complain on a purchase if not a customer", async function() {
        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user2});
        });
    });

    it("can't complain if contract is not active", async function() {
        await payment.setActive(false);
        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("can't resolve if contract is not active", async function() {
        await payment.complain(0, 0, {from:user1}); 
        await payment.setActive(false);
        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:escrow});
        });
    });

    it("can't complain on a purchase if time limit expires", async function() {
        await time.timeTravelAndMine(escrowTime);
        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("resolve dispute: customer won, their balance should be less than payment by amount of escrow fee", async function() {
        await payment.complain(0, 0, {from:user1});

        let oldCustomerBalance = await utils.getBalance(user1);
        await payment.resolve(0, 0, true, {from:escrow});
        let customerBalance = await utils.getBalance(user1);

        assert.equal(
            oldCustomerBalance.plus(utils.dpm(Price1, EscrowFeePermille)).toNumber(),
            customerBalance.toNumber(),
            "Invalid customer balance"
        );

        assert.equal(
            await utils.getBalance(payment.address),
            0,
            "Invalid payment contract balance"
        );
    });

    it("can't resolve dispute if not an escrow", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:user2});
        });
    });

    it("can't complain after dispute is lost", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, false, {from:escrow});

        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("can't complain after dispute is lost and payment is withdrawn", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, false, {from:escrow});
        await payment.withdrawPendingPayments([0],[0],{from:vendor});

        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("can't complain after dispute is won", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, false, {from:escrow});

        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("can't complain after complain", async function() {
        await time.timeTravelAndMine(escrowTime/2);
        await payment.complain(0, 0, {from:user1});

        await utils.expectContractException(async function() {
            await payment.complain(0, 0, {from:user1});
        });
    });

    it("can't complain if product doesn't use escrow", async function() {
        await createProduct({useEscrow:false});
        await payment.buyWithEth(1, 1, "", false, Price1, {from:user1, value:Price1, gasPrice:gasPrice});

        await utils.expectContractException(async function() {
            await payment.complain(1, 0, {from:user1});
        });
    });

    it("can't resolve purchase with invalid id", async function() {
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await payment.resolve(0, 2, true, {from:escrow});
        });
    });

    it("can't resolve purchase with invalid product id", async function() {
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await payment.resolve(0, 2, true, {from:escrow});
        });
    });

    it("can't resolve purchase if there was no complain", async function() {
        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:escrow});
        });
    });

    it("can't resolve purchase if it is resolved", async function() {
        await payment.complain(0, 0, {from:user1});
        await payment.resolve(0, 0, true, {from:escrow});

        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:escrow});
        });
    });    

    it("disable escrow, default escrow can resolve disputes now", async function() {
        await payment.complain(0, 0, {from:user1});
        await escrowStorage.editEscrow(escrow, false, EscrowFeePermille);        
        await payment.resolve(0, 0, true, {from:owner});
        await checkStatus(3);        
    });

    it("disable escrow, they cant resolve dispute anymore", async function() {
        await payment.complain(0, 0, {from:user1});
        await escrowStorage.editEscrow(escrow, false, EscrowFeePermille);        
        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:escrow});
        });        
    });

    it("can't resovle dispute for product assigined to another escrow", async function() {
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await payment.resolve(0, 0, true, {from:owner});
        });
    });
});

contract("ProductPayment. Escrow. Confirm deliver", function(accounts) {
    beforeEach(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow:escrow, escrowTime:escrowTime});
        buyTx = await payment.buyWithEth(0, 1, "", false, Price1, {from:user1, value:Price1, gasPrice:gasPrice}); 
    });

    it("verify data after confirmDeliver call", async function() {
        let tx = await payment.confirmDeliver(0, 0, {from:user1});
        let event = tx.logs[0];

        assert.equal(event.event, "DeliverConfirmed", "Invalid event name");
        assert.equal(event.args.customer, user1, "Invalid event parameter 1");
        assert.equal(event.args.productId, 0, "Invalid event parameter 2");
        assert.equal(event.args.purchaseId, 0, "Invalid event parameter 3");

        await checkStatus(4);
    });

    //status is not paid
    it("can't confirm if status is not Paid", async function() {
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await payment.confirmDeliver(0, 0, {from:user1});
        });
    });

    it("can confirm if escrow hold time elapsed", async function() {
        await time.timeTravelAndMine(escrowTime);
        await payment.confirmDeliver(0, 0, {from:user1});
        await checkStatus(4);
    });

    //wrong customer
    it("can't confirm another user's purchase", async function() {
        await utils.expectContractException(async function() {
            await payment.confirmDeliver(0, 0, {from:owner});
        });
    });

    it("can't confirm if contract is not active", async function() {
        await payment.setActive(false);
        await utils.expectContractException(async function() {
            await payment.confirmDeliver(0, 0, {from:user1});
        });
    });
});

contract("ProducPayment. Escrow. Revoke deal", function(accounts) {
    users = utils.makeRoles(accounts);

    async function revoke(caller = vendor) {
        return await payment.revoke(0, 0, {from:caller});
    }

    beforeEach(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow:escrow, escrowTime:escrowTime});
        buyTx = await payment.buyWithEth(0, 1, "", false, Price1, {from:user1, value:Price1, gasPrice:gasPrice}); 
    });

    it("verify data after revoke", async function() {
        let oldBalance = await utils.getBalance(user1);
        let tx = await revoke();
        await checkStatus(5);

        let newBalance = await utils.getBalance(user1);
        //customer should receive refund (minus escrowFee)
        assert.equal(
            oldBalance.plus(utils.dpm(Price1, EscrowFeePermille)).toNumber(),
            newBalance.toNumber(),
            "Invalid refund amount"
        );

        //check event emitted
        let event = tx.logs[0];        
        assert.equal(event.event, "PurchaseRevoked", "Invalid event name");
        assert.equal(event.args.vendor, vendor, "Invalid event argument 1");
        assert.equal(event.args.productId, 0, "Invalid event argument 2");
        assert.equal(event.args.purchaseId, 0, "Invalid event argument 3");
    });

    it("cant revoke if status is not Paid", async function() {
        await payment.complain(0, 0, {from:user1});
        await utils.expectContractException(async function() {
            await revoke();
        });
    });
    
    it("cant revoke if escrow time elapsed", async function() {
        await time.timeTravelAndMine(escrowTime);
        await utils.expectContractException(async function() {
            await revoke();
        });
    });

    it("cant revoke if contract is not active", async function() {
        await payment.setActive(false);
        await utils.expectContractException(async function() {
            await revoke();
        });
    });
    
    it("cant revoke purchase of another vendor", async function() {
        await utils.expectContractException(async function() {
            await revoke(owner);            
        });
    });
});

contract("ProductPayment. withdraw multiple pendings", function(accounts) {

    beforeEach(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow:escrow, escrowTime:escrowTime});

        //buy several times
        await buy({customer:user1});
        await buy({customer:user1});
        await buy({customer:user1});
        await buy({customer:user2});
        await buy({customer:user2});
        await buy({customer:user2});

        await time.timeTravelAndMine(escrowTime);
    });

    it("verify profit after withdrawal of multiple payments", async function() {
        let oldBalance = await utils.getBalance(vendor);

        let expectedProfit = utils.dpm(6 * Price1, FeePermille + EscrowFeePermille);
        let tx = await payment.withdrawPendingPayments([0,0,0,0,0,0], [0,1,2,3,4,5], {from:vendor, gasPrice:gasPrice});
        let newBalance = await utils.getBalance(vendor);

        assert.equal(
            newBalance.minus(oldBalance).toNumber(),
            expectedProfit - tx.receipt.gasUsed * gasPrice
        );
    });

    it("can't withdraw if called by not owner", async function() {
        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0,0,0,0,0,0], [0,1,2,3,4,5]);
        });
    });

    it("can't withdraw if array lengths don't match", async function() {
        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0,0,0,0,0], [0,1,2,3,4,5], {from:vendor});
        });
    });

    it("can't withdraw if already withdrawn", async function() {
        await payment.withdrawPendingPayments([0,0], [0,4], {from:vendor});

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0,0], [0,4], {from:vendor});
        });
    });

    it("can't withdraw if complain time hasn't expired", async function() {
        await buy({customer:user1});
        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0], [6], {from:vendor});
        });
    });

    it("can't withdraw if at least one payment canceled", async function() {
        await buy({customer:user1});
        await payment.complain(0,6,{from:user1});
        await payment.resolve(0, 6, true, {from:escrow});

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0, 0], [0, 6], {from:vendor});
        });
    });

    it("can't withdraw if payment contract is inactive", async function() {
        await payment.setActive(false);
        assert.isFalse(await payment.activeState.call(), "Contract should be inactive");

        await utils.expectContractException(async function() {
            await payment.withdrawPendingPayments([0,0,0,0,0,0], [0,1,2,3,4,5], {from:vendor, gasPrice:gasPrice});
        });
    });
});


contract("ProductPayment. Fiat price. 1 ETH = 1000$", function(accounts) {
    const usdCentPrice = 5000;
    const NewEthRate = WeisForCent / 2;
    let tx;

    beforeEach(async function() {
        await prepare(accounts);
        await createProduct({price:usdCentPrice, useFiatPrice:true});
    });

    async function testBuy(eth, expectedEthChange) {
        let oldPurchases = (await storage.getTotalPurchases.call(0)).toNumber();
        let oldVendorBalance = await utils.getBalance(vendor);
        let oldBalance = await utils.getBalance(user1);
        tx = await payment.buyWithEth(0, 1, "ID", true, usdCentPrice, {from:user1, value:eth, gasPrice:gasPrice});
        let gasCost = tx.receipt.gasUsed*gasPrice;
        let newBalance = await utils.getBalance(user1);
        let newVendorBalance = await utils.getBalance(vendor);

        assert.equal(await storage.getTotalPurchases.call(0), oldPurchases + 1, "Invalid purchase count");

        assert.equal(await utils.getBalance(payment.address), 0, "payment contract should be empty");

        assert.equal(
            oldBalance.minus(newBalance).toNumber(),
            +gasCost + expectedEthChange,
            "invalid customer's balance change"
        );

        assert.equal(
            utils.dpm(eth, FeePermille),
            newVendorBalance.minus(oldVendorBalance).toNumber(),
            "Invalid vendor's balance"
        );
    }

    it("purchase one unit of product that costs 50$. no customer discount", async function() {
        let ethSent = usdCentPrice * WeisForCent;
        await testBuy(ethSent, ethSent);
    });

    it("verifies data in the purchase event after payment", async function() {
        await token.transfer(user2, LevelTokens[0], {from:owner});
        await utils.sendEther(owner, pool.address, MinPoolForDiscount);

        let ethPrice = usdCentPrice * WeisForCent;
        let buyTx = await payment.buyWithEth(0, 2, "id", false, usdCentPrice, {from:user2, value:ethPrice * 2});

        assert.equal(buyTx.logs[0].args.buyer, user2, "Invalid customer");
        assert.equal(buyTx.logs[0].args.vendor, vendor, "Invalid vendor");
        assert.equal(buyTx.logs[0].args.productId, 0, "Invalid product id");
        assert.equal(buyTx.logs[0].args.purchaseId, 0, "Invalid purchase id");
        assert.equal(buyTx.logs[0].args.clientId, "id", "Invalid client id");
        assert.equal(buyTx.logs[0].args.price.toNumber(), ethPrice, "Invalid price");
        assert.equal(buyTx.logs[0].args.paidUnits.toNumber(), 2, "Invalid paid units");
        assert.equal(buyTx.logs[0].args.discount.toNumber(), MinPoolForDiscount/DiscountsInPool, "Invalid discount");
    });

    it("purchase one unit of product that costs 50$. customer discount", async function() {
        await token.transfer(user1, LevelTokens[0], {from:owner});
        await utils.sendEther(owner, etherFund.address, MinPoolForDiscount / 0.8); // divide by 0.8 as 20% goes to company

        let ethSent = usdCentPrice * WeisForCent;
        let discount = MinPoolForDiscount / DiscountsInPool;
        let expectedEthChange = ethSent;

        await testBuy(ethSent, expectedEthChange);

        assert.equal(
            tx.logs[0].args.discount,
            discount,
            "Invalid cashback accumulated"
        );
    });

    it("purchase one unit, eth price changes, purchase another unit", async function() {
        let ethSent1 = usdCentPrice * WeisForCent;
        await testBuy(ethSent1, ethSent1);

        //eth price drops x2
        let tx = await etherPriceProvider.updateRate(NewEthRate);
        
        let ethSent2 = usdCentPrice * NewEthRate;
        await testBuy(ethSent2, ethSent2);
    });
});

contract("ProductPayment. Buy with tokens (bancor)", function(accounts) {
    let bcsConverter;
    let quickConverter;
    let ethToken;
    let bntToken;
    let bntConverter;
    let bancor;    
    let quickBuyPath;

    before(async function() {
        await prepare(accounts);
        bancor = await utils.createBancor(bancorOwner, owner, token, payment, artifacts);
        bcsConverter = bancor.bcsConverter;
        quickConverter = bancor.quickConverter;
        ethToken = bancor.ethToken;
        bntToken = bancor.bntToken;
        bntConverter = bancor.bntConverter;
        relayToken = bancor.relayToken;        

        quickBuyPath = [
            bancor.ethToken.address,
            bancor.bntToken.address,
            bancor.bntToken.address,
            bancor.relayToken.address,
            token.address
        ];
    });

    // it("check bancor setup, sell 1 bcs", async function() {
    //     let amount = OneEther; //1 bcs
            //await token.approve(bcsConverter.address, await utils.TB(token, owner), {from:owner});
    //     let oldTokens = await utils.TB(token, owner);
    //     let oldBalance = await utils.getBalance(owner);
    //     let tx = await bcsConverter.quickConvert(quickSellPath, amount, 1, {from:owner, gasPrice: gasPrice});

    //     let newTokens = await utils.TB(token, owner);
    //     let newBalance = await utils.getBalance(owner);

    //     assert.equal(oldTokens - newTokens, amount, "invalid tokens sold");
    //     let gained = newBalance.minus(oldBalance).plus(tx.receipt.gasUsed*gasPrice).toNumber();
    //     console.log(await utils.TB(ethToken, owner));
    //     console.log(`${gained/OneEther} ether gained`);
    // });

    it("calculate price", async function() {
        let tokensInConverter = await utils.TB(token, bcsConverter.address);
        console.log(`Tokens in converter ${tokensInConverter/OneEther}`);
        console.log(`ETH for 0.1 BCS is ${await utils.getBancorEth(token, bancor, 0.1 * OneEther)}`);
        console.log(`ETH for 10 BCS is ${await utils.getBancorEth(token, bancor, OneEther)}`);
        console.log(`ETH for 10 BCS is ${await utils.getBancorEth(token, bancor, 10 * OneEther)}`);

        let price = Price1;
        let tokens = await utils.calculateBancorBcsForEth(token, bancor, price);
        let ethEqv = await utils.getBancorEth(token, bancor, tokens);
        console.log(`Tokens for ${price/OneEther} ETH is ${tokens/OneEther}`)
        console.log(`ETH for Tokens is ${ethEqv/OneEther}`);
        //console.log("Max eth is: " + (await utils.getBancorMaxEth(bancor))/OneEther);
    });

    it("check inverted operations", async function() {
        let amount = 160000000000000000;// Price1;
        let bcsAmount = await utils.calculateBancorBcsForEth(token, bancor, amount);
        console.log(`We need ${bcsAmount/OneEther} BCS to pay for purchase ${amount/OneEther} ETH`);

        let ethAmount = await utils.calculateBancorEthForBcs(token, bancor, bcsAmount);
        console.log(`We need ${ethAmount/OneEther} ETH to buy ${bcsAmount/OneEther} BCS`);
    });

    it("purchase using BCS", async function() {
        await createProduct();
        let tokensToUser = LevelTokens[2];

        await utils.sendEther(owner, pool.address, MinPoolForDiscount);
        await token.transfer(user1, tokensToUser); //not enough for discount but enough for purchase
        await token.approve(payment.address, tokensToUser*2, {from:user1});

        let tokens = await utils.calculateBancorBcsForEth(token, bancor, Price1);        
        let ethEqv = await utils.getBancorEth(token, bancor, tokens);
        let oldVendorBalance = await utils.getBalance(vendor);
        let oldCustomerBalance = await utils.getBalance(user1);

        assert.isAbove((await token.allowance.call(user1, payment.address)).toNumber(), tokens, "Invalid allowance");
        assert.isAbove(tokensToUser, tokens, "invalid tokens amount");

        let oldSum = (await utils.TB(token, user1)) + (await utils.TB(token, bcsConverter.address)) + (await utils.TB(token, quickConverter.address));
        let tx = await payment.buyWithTokens(tokens, 0, 1, "ID", true, Price1, {from:user1, gasPrice:gasPrice});
        console.log("Gas used: " + tx.receipt.gasUsed);
        let newSum = (await utils.TB(token, user1)) + (await utils.TB(token, bcsConverter.address)) + (await utils.TB(token, quickConverter.address));

        assert.equal(
            (await utils.getBalance(user1)).toNumber(),
            oldCustomerBalance.minus(gasPrice*tx.receipt.gasUsed).plus(ethEqv-Price1).toNumber(),
            "Invalid user balance"
        );
        assert.equal(oldSum, newSum, "Sum of tokens shouldn't be changed");
        assert.equal(
            (await utils.getBalance(vendor)).toNumber(),
            oldVendorBalance.plus(utils.dpm(Price1, FeePermille)).toNumber(),
            "Invalid vendor balance"
        );
        assert.equal(tokens + (await utils.TB(token, user1)), tokensToUser, "Invalid tokens left for customer");
    });    

    it("purchase using BCS, not enough BCS for purchase, should fail", async function() {
        let tokens = await utils.calculateBancorBcsForEth(token, bancor, Price1);
        let tokensToUser = tokens * 8 / 10;
        let expectedEth = await utils.getBancorEth(token, bancor, tokensToUser);
        
        await token.transfer(user2, tokensToUser);
        await token.approve(payment.address, tokensToUser, {from:user2});
                        
        assert.equal(await utils.TB(token, user2), tokensToUser, "Invalid user token balance");
        assert.isAbove(Price1, expectedEth, "converted price should be below the required");

        await utils.expectContractException(async function() {
            let tx = await payment.buyWithTokens(tokensToUser, 0, 1, "ID", true, Price1, {from:user2, gasPrice:gasPrice});
        });        
    });

    it("buy tokens via bancor", async function() {
        await token.transfer(user2, 123456789);

        let value = OneEther/100;
        let oldBcsBalance = await utils.TB(token, user2);
        let bcsExpected = await utils.getBancorBcs(token, bancor, value);        
        //let tx = await web3.eth.sendTransaction({from:user2, to:bcsConverter.address, value:value, gas:700000});           
        let tx = await bcsConverter.quickConvert(quickBuyPath, value, bcsExpected*0.9, {from:user2, value:value});
        let newBcsBalance = await utils.TB(token, user2);
        assert.equal(oldBcsBalance + bcsExpected, newBcsBalance, "Invalid tokens received");
    });

    it("buy tokens via bancor, fail as less than minReturn", async function() {
        let value = OneEther/100;
        let bcsExpected = await utils.getBancorBcs(token, bancor, value);

        await utils.expectContractException(async function() {
            await bcsConverter.quickConvert(quickBuyPath, value, bcsExpected*1.2, {from:user2, value:value});
        });      
    });
});


contract("ProductPayment. compare cashback: BCS vs ETH purchase", function(accounts) {
    let bcsConverter;
    let quickConverter;
    let ethToken;
    let bntToken;
    let bntConverter;
    let bancor;    
    let quickBuyPath;

    before(async function() {
        await prepare(accounts);
        bancor = await utils.createBancor(bancorOwner, owner, token, payment, artifacts);
    });

    it("", async function() {
        await createProduct();
        let tokensToUser = LevelTokens[2];

        await utils.sendEther(owner, pool.address, MinPoolForDiscount);
        await token.transfer(user1, tokensToUser); 
        await token.transfer(user2, tokensToUser); 
        await token.approve(payment.address, tokensToUser, {from:user1});

        let tokens = await utils.calculateBancorBcsForEth(token, bancor, Price1);        
        let ethEqv = await utils.getBancorEth(token, bancor, tokens);        
        
        let tx = await payment.buyWithTokens(tokens, 0, 1, "ID", true, Price1, {from:user1, gasPrice:gasPrice});
        //console.log(tx.logs[0].args.discount);
        
        let tx2 = await buy({customer:user2});
       // console.log(tx2.logs[0].args.discount);

        assert.isAbove(
            tx2.logs[0].args.discount.toNumber(), 
            tx.logs[0].args.discount.toNumber(), 
            "Cashback should be higher when purchasing for eth"
        );
    });  
});


contract("ProductPayment. Replace payment contract", function(accounts) {
    let balance;
    let newPayment;

    before(async function() {
        await prepare(accounts);
        await escrowProvider.update(EscrowFeePermille, {from:escrow});
        await createProduct({useEscrow:true, escrow: escrow, escrowTime:escrowTime});
        await buy({});

        balance = await utils.getBalance(payment.address);
    });

    it("can't withdraw ether as not an owner", async function() {
        await utils.expectContractException(async function() {
            await payment.withdrawEtherTo(balance, escrow, {from:user1});
        });
    });

    it("withdraw ether from payment contract", async function() {
        let receiverBalance = await utils.getBalance(escrow);
        assert.isAbove(balance.toNumber(), 0, "Contract should contain some ETH");

        await payment.withdrawEtherTo(balance, escrow);

        assert.equal((await utils.getBalance(payment.address)).toNumber(), 0, "Payment should be empty");
        assert.equal((await utils.getBalance(escrow)).toNumber(), receiverBalance.plus(balance).toNumber(), "Invalid receiver balance");
    });

    it("create new payment contract and transfer ether to it", async function() {
        newPayment = await utils.createPayment(storage, escrowProvider, feePolicy, discountPolicy, token, etherPriceProvider);
        //await newPayment.setManager(escrow, true);

        await utils.sendEther(escrow, newPayment.address, balance);

        assert.equal((await utils.getBalance(newPayment.address)).toNumber(), balance.toNumber(), "Invalid balance");
    });

    it("vendor withdraws payments from this contract", async function() {
        await time.timeTravelAndMine(escrowTime);
        assert.isTrue(await newPayment.canWithdrawPending.call(0,0), "Should be true");

        let oldVendorBalance = await utils.getBalance(vendor);        
        let tx = await newPayment.withdrawPendingPayments([0], [0], {from:vendor, gasPrice:gasPrice});
        let newVendorBalance = await utils.getBalance(vendor);

        assert.equal(
            oldVendorBalance.plus(utils.dpm(Price1, FeePermille+EscrowFeePermille)).toNumber(),
            newVendorBalance.plus(tx.receipt.gasUsed*gasPrice).toNumber(),
            "Invalid amount received"
        );
        assert.equal(
            await storage.getPurchase.call(0, 0), 0, "Invalid status"
        );
    });

    it("can't withdraw from the old contract", async function() {
        await utils.expectContractException(async function() {
            let tx = await payment.withdrawPendingPayments([0], [0], {from:vendor, gasPrice:gasPrice});
        });
    });
});

contract("measure gas", function(accounts) {
    it("", async function() {
        await prepare(accounts);
        console.log("EtherPriceProvider: " + web3.eth.getTransactionReceipt(etherPriceProvider.transactionHash).gasUsed);  
        console.log("ProductPayment: " + web3.eth.getTransactionReceipt(payment.transactionHash).gasUsed);  
    });
});





// contract("ProductPayment. Withdraw multiple pendings. Gas. ", function(accounts) {
//     beforeEach(async function() {
//         await prepare(accounts);
//         await createProduct({useEscrow:true});
//         await createProduct({useEscrow:true});

//         //buy several times
//         for(let i=0; i <10; i++) {
//             await buy({productId:0, customer:user1});
//             await buy({productId:1, customer:user1});
//         }

//         await time.timeTravelAndMine(escrowTime);
//     });
//     /*
//     withdrawPendingPayments. 2 arrays
//     1x1 - 62.2k
//     10x1 - 151.8k
//     1x2 - 72.1k
//     10x2 - 276k
//     */

//     // it("200 x 1", async function() {
//     //     let productIds = [];
//     //     let purchaseIds = [];
//     //     let currentPurchase = 0;

//     //     for(let p = 0; p < 10; ++p) {
//     //         for(let i = 0; i < 20; ++i) {
//     //             productIds.push(p);
//     //             purchaseIds.push(i);
//     //             await buy({productId:p, customer:accounts[i%10]});
//     //         }
//     //     }

//     //     await time.timeTravelAndMine(escrowTime);
//     //     console.log(productIds.toString());
//     //     console.log(purchaseIds.toString());
//     //     let tx = await payment.withdrawPendingPayments(
//     //         productIds,
//     //         purchaseIds,
//     //         {from:vendor, gasPrice:gasPrice}
//     //     );
//     //     console.log("Gas used: " + tx.receipt.gasUsed);
//     // });

//     it("gas usage. 1 payment for one product", async function() {
//         let tx = await payment.withdrawPendingPayments(
//             [0],
//             [0],
//             {from:vendor, gasPrice:gasPrice}
//         );
//         console.log("Gas used: " + tx.receipt.gasUsed);
//     });

//     it("gas usage. 10 payments for one product", async function() {
//         let tx = await payment.withdrawPendingPayments(
//             [0,0,0,0,0,0,0,0,0,0],
//             [0,1,2,3,4,5,6,7,8,9],
//             {from:vendor, gasPrice:gasPrice}
//         );
//         console.log("Gas used: " + tx.receipt.gasUsed);
//     });

//     it("gas usage. 1 payments for each of two products", async function() {
//         let tx = await payment.withdrawPendingPayments(
//             [0, 1],
//             [0, 0],
//             {from:vendor, gasPrice:gasPrice}
//         );
//         console.log("Gas used: " + tx.receipt.gasUsed);
//     });

//     it("gas usage. 10 payments for each of two products", async function() {
//         let tx = await payment.withdrawPendingPayments(
//             [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
//             [0, 1, 2, 3, 4, 5,6,7,8,9,0, 1, 2, 3, 4, 5,6,7,8,9],
//             {from:vendor, gasPrice:gasPrice}
//         );
//         console.log("Gas used: " + tx.receipt.gasUsed);
//     });

//     /*
//     withdrawPendingPayments. 3 arrays
//     1x1 - 62.9k
//     10x1 - 151.8k
//     1x2 - 73.4k
//     10x2 - 275.6k
//     */

//     // it("gas usage. 1 payment for one product", async function() {
//     //     let tx = await payment.withdrawPendingPayments(
//     //         [0],
//     //         [1],
//     //         [0],
//     //         {from:vendor, gasPrice:gasPrice}
//     //     );
//     //     console.log("Gas used: " + tx.receipt.gasUsed);
//     // });

//     // it("gas usage. 10 payments for one product", async function() {
//     //     let tx = await payment.withdrawPendingPayments(
//     //         [0],
//     //         [10],
//     //         [0,1,2,3,4,5,6,7,8,9],
//     //         {from:vendor, gasPrice:gasPrice}
//     //     );
//     //     console.log("Gas used: " + tx.receipt.gasUsed);
//     // });

//     // it("gas usage. 1 payments for each of two products", async function() {
//     //     let tx = await payment.withdrawPendingPayments(
//     //         [0, 1],
//     //         [1, 1],
//     //         [0, 0],
//     //         {from:vendor, gasPrice:gasPrice}
//     //     );
//     //     console.log("Gas used: " + tx.receipt.gasUsed);
//     // });

//     // it("gas usage. 10 payments for each of two products", async function() {
//     //     let tx = await payment.withdrawPendingPayments(
//     //         [0, 1],
//     //         [10, 10],
//     //         [0, 1, 2, 3, 4, 5,6,7,8,9, 0, 1, 2, 3, 4,5,6,7,8,9],
//     //         {from:vendor, gasPrice:gasPrice}
//     //     );
//     //     console.log("Gas used: " + tx.receipt.gasUsed);
//     // });
// });


/*
тесты

5 цена газа
*/
