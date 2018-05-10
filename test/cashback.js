

let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let time = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

const jsutil = require('util');

let storage;
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
let user3;
let bancorOwner;
let manager;

let WeisForCent = 10000000000000;
let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let ProfitPermille = 200;
let DiscountPermille = 800;
let MinPoolForDiscount = OneEther / 1000;
let DiscountsInPool = 100;
let MaxDiscount = 50; //=5%
const E18 = 1000000000000000000;
const LevelTokens = [E18, 2*E18, 3*E18]; 
const LevelPcts = [100, 200, 300];


let MinTokensForFeeDiscount = 10000000000000000000; //10 bcs
let FeePermille = 100;
let EscrowFeePermille = 50;
let FiatPriceFeePermille = 70;
let FeeDiscountTerm = 86400; //1 day
let MaxTotalDiscountPerToken = utils.toWei(0.1);
let FeeDiscountPermille = 600;

let bancorConverter;
let escrowTime = 3600; //1 hour

async function createProduct(options = {}) {
    await factory.createSimpleProduct(
        utils.or(options.price, Price1),
        utils.or(options.maxUnits, 0),
        utils.or(options.isActive, true),
        utils.or(options.startTime, 0),
        utils.or(options.endTime, 0),
        utils.or(options.useEscrow, false),
        utils.or(options.useFiatPrice, false),
        utils.or(options.name, "Name"),
        utils.or(options.data, "Email"),
        {from:vendor});
}

async function buy(pid, units, customer) {
    let price = await storage.getProductPrice.call(pid);
    return await payment.buyWithEth(pid, units, "info", false, price, {from:customer, value:price*units});
}

async function prepare(accounts) {
    owner = accounts[0];
    provider = accounts[1];
    escrow = accounts[2];
    user1 = accounts[3];
    user2 = accounts[4];
    user3 = accounts[9];
    vendor = accounts[5];
    vendorWallet = accounts[6];
    bancorOwner = accounts[7];
    manager = accounts[9];
    bancorConverter = accounts[9];

    token = await utils.createToken();
    let result = await utils.createFunds(provider, ProfitPermille);
    pool = result.proxy;
    etherFund = result.fund;
    discountPolicy = await utils.createDiscountPolicy(MinPoolForDiscount, DiscountsInPool, MaxDiscount, pool, token, LevelTokens, LevelPcts);
    storage = await utils.createProductStorage();
    factory = await utils.createProductFactory(storage);
    etherPriceProvider = await utils.createEtherPriceProvider(WeisForCent); //1 eth = 1000$
    feePolicy = await utils.createFeePolicy(
        storage, FeePermille, EscrowFeePermille, FiatPriceFeePermille, etherFund.address, token,
        MinTokensForFeeDiscount, FeeDiscountTerm, MaxTotalDiscountPerToken, FeeDiscountPermille
    );
    payment = await utils.createPayment(storage, feePolicy, discountPolicy, token, etherPriceProvider, escrowTime);
    await payment.setManager(escrow, true);
    await discountPolicy.setManager(manager, true);

    await token.transfer(user1, LevelTokens[0]);
    await token.transfer(user2, LevelTokens[1]);
    await token.transfer(user3, LevelTokens[0] / 2);    

    await utils.sendEther(owner, etherFund.address, MinPoolForDiscount * 2);
}

//
// Cashback calculation
//

//retrieves cashback value from the payment transaction
function getCashbackFromPayment(paymentTx) {    
    return paymentTx.logs[0].args.discount.toNumber();
}

async function processPurchase(productId, purchaseId, customer, cashback, payment, storage, cashbackInfo) {
    if(cashback == 0) return;

    let cashbackState; //0-ignore, 1-pay, 2-wait
    let purchaseState = await storage.getPurchase.call(productId, purchaseId);
    
    if(purchaseState == 3) {
        cashbackState = 0
    } else {
        let canWithdrawPending = (await payment.canWithdrawPending.call(productId, purchaseId)) == true;
        if(purchaseState == 0 || canWithdrawPending) {
            cashbackState = 1;
            
            if(cashbackInfo.cashback[customer] == undefined) {
                cashbackInfo.cashback[customer] = 0;
            }

            cashbackInfo.cashback[customer] += +cashback;
        } else {
            cashbackState = 2;
            cashbackInfo.pending.push({
                productId:productId,
                purchaseId:purchaseId,
                customer:customer,
                cashback:cashback
            });
        }
    }

    console.log(`${customer}. Purchase ${productId}-${purchaseId}. State ${cashbackState}. Cashback ${cashback}.`);                                
}

async function getPaymentLogs(payment, fromBlock, toBlock) {
    let event = payment.ProductBought({}, {fromBlock:fromBlock, toBlock:toBlock});
    let getLogs = jsutil.promisify(event.get).bind(event);   
    return (await getLogs());        
}
//calculates cashback for certain block ranges. it includes cashbacks for purchases with 'Finished' status
//Returns: {pending, cashback, blocks}
// pending - list of transactions to check later pending[i]={productId, purchaseId}
// cashback - map of accumulated cashback {customer=>amount}
// blocks.from and blocks.to - parameters of events search
async function calculateCashback(payment, storage, fromBlock, toBlock, previousCashbackInfo = null) {
    let cashbackInfo = {
        pending: [],
        cashback: {},
        blocks: {from:fromBlock, to:toBlock}
    };

    let logs = await getPaymentLogs(payment, fromBlock, toBlock);
    for(let i = 0; i < logs.length; ++i) {
        await processPurchase(
            logs[i].args.productId.toNumber(), 
            logs[i].args.purchaseId.toNumber(), 
            logs[i].args.buyer.toString(), 
            logs[i].args.discount.toNumber(), 
            payment, 
            storage, 
            cashbackInfo
        );
    }

    if(previousCashbackInfo != null) {
        for(let i = 0; i < previousCashbackInfo.pending.length; ++i) {
            await processPurchase(
                previousCashbackInfo.pending[i].productId, 
                previousCashbackInfo.pending[i].purchaseId, 
                previousCashbackInfo.pending[i].customer, 
                previousCashbackInfo.pending[i].cashback, 
                payment, 
                storage, 
                cashbackInfo
            );
        }
    }
    
    return cashbackInfo;
}

//
// Tests
//

contract("Cashback script", function(accounts) {

    let cashbackInfo;
    let tx;
    let fromBlock;
    let toBlock;

    before(async function() {
        await prepare(accounts);
        await createProduct({useEscrow:false, name:"InstantBuy"});
        await createProduct({useEscrow:true, name:"Escrow"});
    });

    it("1st period", async function() {                
        let expectedCashback1 = 0;
        let expectedCashback2 = 0;
        let expectedCashback3 = 0;

        fromBlock = web3.eth.blockNumber - 1;

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
        
        await time.timeTravelAndMine(escrowTime);        

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

        toBlock = web3.eth.blockNumber;

        console.log("From block " + fromBlock);
        console.log("Current block " + toBlock);

        cashbackInfo = await calculateCashback(payment, storage, fromBlock, toBlock);
       // console.log(cashbackInfo);

        // console.log(expectedCashback1);
        // console.log(expectedCashback2);
        // console.log(expectedCashback3);
        assert.equal(cashbackInfo.cashback[user1.toString()], expectedCashback1, "Invalid cashback for user1");
        assert.equal(cashbackInfo.cashback[user2.toString()], expectedCashback2, "Invalid cashback for user2");
        assert.equal(cashbackInfo.cashback[user3.toString()], undefined, "Invalid cashback for user3");

        assert.equal(cashbackInfo.pending.length, 2, "Invalid pending cashbacks");        
        assert.equal(cashbackInfo.pending[0].purchaseId, 7, "Invalid pending cashback 2");
        assert.equal(cashbackInfo.pending[0].customer, user1, "Invalid pending cashback 2 customer");        
        assert.equal(cashbackInfo.pending[1].purchaseId, 8, "Invalid pending cashback 3");
        assert.equal(cashbackInfo.pending[1].customer, user2, "Invalid pending cashback 3 customer");        
    });

    it("add cashbacks for user", async function() {
        let customers = Object.keys(cashbackInfo.cashback);
        let cashbacks = [];
        for(let i = 0; i < customers.length; ++i) {
            cashbacks.push(cashbackInfo.cashback[customers[i]]);
        }

        await discountPolicy.addCashbacks(customers, cashbacks, {from:manager});

        assert.equal(await discountPolicy.totalCashback.call(user1), cashbackInfo.cashback[user1], "User1 got invalid cashback");
        assert.equal(await discountPolicy.totalCashback.call(user2), cashbackInfo.cashback[user2], "User2 got invalid cashback");
    });

    it("user1 withdraws his cashback after period 1", async function() {
        await discountPolicy.withdrawCashback({from:user1});
        assert.equal(await discountPolicy.totalCashback.call(user1), 0, "User1 hasn't got cashback");
    });

    it("2nd period. Pending transactions from the previous period should be added", async function() {
        await token.transfer(user3, LevelTokens[2]);

        await payment.complain(1, 7, {from:user1});
        await payment.resolve(1, 7, true, {from:escrow});        

        let expectedCashback1 = 0;
        let expectedCashback2 = cashbackInfo.pending[1].cashback;
        let expectedCashback3 = 0;        

        tx = await buy(1, 1, user3); 
        expectedCashback3 += getCashbackFromPayment(tx);

        tx = await buy(1, 2, user2); 
        expectedCashback2 += getCashbackFromPayment(tx);

        tx = await buy(0, 1, user2);
        expectedCashback2 += getCashbackFromPayment(tx);

        tx = await buy(0, 1, user1);
        expectedCashback1 += getCashbackFromPayment(tx);

        await time.timeTravelAndMine(escrowTime);

        tx = await buy(0, 1, user1);
        expectedCashback1 += getCashbackFromPayment(tx);

        tx = await buy(1, 2, user3);

        fromBlock = toBlock;
        toBlock = web3.eth.blockNumber; 
        cashbackInfo = await calculateCashback(payment, storage, fromBlock, toBlock, cashbackInfo);
       // console.log(cashbackInfo);

        assert.equal(cashbackInfo.cashback[user1.toString()], expectedCashback1, "Invalid cashback for user1");
        assert.equal(cashbackInfo.cashback[user2.toString()], expectedCashback2, "Invalid cashback for user2");
        assert.equal(cashbackInfo.cashback[user3.toString()], expectedCashback3, "Invalid cashback for user3");

        assert.equal(cashbackInfo.pending.length, 1, "Invalid number of pending cashbacks");        
        assert.equal(cashbackInfo.pending[0].purchaseId, 11, "Invalid pending cashback 2");
        assert.equal(cashbackInfo.pending[0].customer, user3, "Invalid pending cashback 2 customer");        
    });

    it("add cashbacks for users after period 2", async function() {
        let oldCashbackUser2 = await discountPolicy.totalCashback.call(user2)

        console.log();     
        let customers = Object.keys(cashbackInfo.cashback);
        let cashbacks = [];
        for(let i = 0; i < customers.length; ++i) {
            cashbacks.push(cashbackInfo.cashback[customers[i]]);
        }

        await discountPolicy.addCashbacks(customers, cashbacks, {from:manager});

        assert.equal(
            await discountPolicy.totalCashback.call(user1), 
            cashbackInfo.cashback[user1], 
            "User1 got invalid cashback");
        
        assert.equal(
            await discountPolicy.totalCashback.call(user2), 
            oldCashbackUser2.plus(cashbackInfo.cashback[user2]).toNumber(), 
            "User2 got invalid cashback"
        );
    });

    it("users withdraw their cashback", async function() {
        let expected1 = await discountPolicy.totalCashback.call(user1);
        let expected2 = await discountPolicy.totalCashback.call(user2);
        
        let balance = await utils.getBalance(user1);
        let tx = await discountPolicy.withdrawCashback({from:user1, gasPrice:gasPrice});        
        assert.equal(await discountPolicy.totalCashback.call(user1), 0, "User1 hasn't got cashback");
        assert.equal(
            (await utils.getBalance(user1)).toNumber(),
            balance.minus(tx.receipt.gasUsed*gasPrice).plus(expected1).toNumber(),
            "Invalid cashback withdrawn by user1"
        );

        balance = await utils.getBalance(user2);
        tx = await discountPolicy.withdrawCashback({from:user2, gasPrice:gasPrice});        
        assert.equal(await discountPolicy.totalCashback.call(user2), 0, "User2 hasn't got cashback");
        assert.equal(
            (await utils.getBalance(user2)).toNumber(),
            balance.minus(tx.receipt.gasUsed*gasPrice).plus(expected2).toNumber(),
            "Invalid cashback withdrawn by user2"
        );
    });
});