let fs = require("fs");

let VendorApprove = artifacts.require("VendorApprove");

let users;

let TokenCap = 10000;
let TokenDecimals = 18;
let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let ProfitPermille = 200;
let MinPoolForDiscount = OneEther / 1000;
let DiscountsInPool = 10;
let MaxDiscount = 300; //=30%
let MinTokensForFeeDiscount = 10000000000000000000; //10 bcs
let FeePermille = 100;
let EscrowFeePermille = 50;
let AffiliateFeePermille = 330;
let FeeDiscountTerm = 86400; //1 day
const MaxDiscountPerToken = OneEther/10;
let FeeDiscountPermille = 600;
let EscrowTime = 3600; //1 hour
let EscrowTimeLong = 7200; //2 hours
const LevelTokens = [OneEther, 2*OneEther, 3*OneEther]; 
const LevelPcts = [100, 200, 300];
const ApprovePrice = 10000000000000000000;

let testSigner = "0x375E517C5A38Fe9e1D48A4F6c1BE162D431cD4FF";

module.exports = async function(deployer, network, accounts) {    
    let Utils = require("../test/utils.js");
    let utils = new Utils(Utils.createWeb3(network), artifacts);
    let time = new (require("../test/timeutils.js"))(utils._web3);    

    let saveContract = function(truffleContract) {
        return {
            address: truffleContract.address,
            block: utils._web3.eth.blockNumber,
            abi: truffleContract.abi              
        };
    } 

    let info = {
        storage: {},
        affStorage: {},
        escrowStorage: {},    
        escrowProvider: {},
        factory: {},
        feePolicy: {},            
        discountPolicy: {},
        payment: {},    
        token: {},
        feePool: {},
        discountPool: {},        
        etherPrice: {},
        bcsConverter: {},
        bntConverter: {},
        bntToken: {},
        ethToken: {},
        relayToken: {},
        extensions: {},
        gasPriceLimit: {},
        vendorApprove: {}
    };

    let owner = accounts[0];
    let provider = accounts[1];
    let escrow = accounts[2];    
    let user1 = accounts[3];
    let user2 = accounts[4];
    let vendor1 = accounts[5];
    let vendor2 = accounts[6];
    let bancorOwner = accounts[7];    
    let affiliate = accounts[8];
    let defaultEscrow = accounts[9];

    let approver = accounts[2];    

    let storage;
    let factory;
    let token;
    let feePool;
    let discountPool;
    let feePolicy;
    let discountPolicy;
    let payment;
    let etherPrice;

    //
    //deploy v1 contracts
    //

    console.log("Deploy v1");

    storage = await utils.createProductStorage();
    info.storage = saveContract(storage);

    token = await utils.createToken(TokenCap, TokenDecimals);
    info.token = saveContract(token);

    affStorage = await utils.createAffiliateStorage();
    info.affStorage = saveContract(affStorage);

    escrowStorage = await utils.createEscrowStorage(defaultEscrow, EscrowFeePermille);
    info.escrowStorage = saveContract(escrowStorage);

    escrowProvider = await utils.createEscrowProvider(escrowStorage, defaultEscrow, EscrowTime, EscrowFeePermille);
    info.escrowProvider = saveContract(escrowProvider);

    factory = await utils.createProductFactory(storage, affStorage, escrowStorage);
    info.factory = saveContract(factory); 

    let funds = await utils.createFunds(provider, ProfitPermille);
    discountPool = funds.proxy;
    feePool = funds.fund;
    
    info.discountPool = saveContract(discountPool);
    info.feePool = saveContract(feePool);

    discountPolicy = await utils.createDiscountPolicy(
        MinPoolForDiscount, DiscountsInPool, MaxDiscount, discountPool, token, LevelTokens, LevelPcts
    );
    info.discountPolicy = saveContract(discountPolicy);

    feePolicy = await utils.createFeePolicy(
        storage, affStorage, escrowProvider, FeePermille, AffiliateFeePermille, feePool.address, token,
        MinTokensForFeeDiscount, FeeDiscountTerm, MaxDiscountPerToken, FeeDiscountPermille);
    info.feePolicy = saveContract(feePolicy);
    
    etherPrice = await utils.createEtherPriceProvider(10000000000000);
    info.etherPrice = saveContract(etherPrice);

    payment = await utils.createPayment(storage, escrowProvider, feePolicy, discountPolicy, token, etherPrice);
    info.payment = saveContract(payment);
    
    let vendorApprove = await VendorApprove.new(token.address, ApprovePrice, [approver]);
    info.vendorApprove = saveContract(vendorApprove);    

    let bancorData = await utils.createBancor(bancorOwner, owner, token, payment, artifacts);

    info.bcsConverter = saveContract(bancorData.bcsConverter);    
    info.bntConverter = saveContract(bancorData.bntConverter);    
    info.bntToken = saveContract(bancorData.bntToken);    
    info.ethToken = saveContract(bancorData.ethToken);    
    info.relayToken = saveContract(bancorData.relayToken);
    info.extensions = saveContract(bancorData.extensions);
    info.gasPriceLimit.abi = bancorData.gasPriceLimit.abi;
    
    
    //
    //v1 deployed, do some operations
    //
    console.log("Do some operations v1");
    
    await utils.sendEther(owner, discountPool.address, MinPoolForDiscount * 10);
    let tokens = 1000000000000000000;
    await token.transfer(accounts[1], tokens);
    await token.transfer(accounts[2], 2 * tokens);
    await token.transfer(accounts[3], 30 * tokens);
    await token.transfer(accounts[4], 2* tokens);
    await token.transfer(accounts[5], 20 * tokens);

    //add new escrow
    await escrowProvider.update(EscrowFeePermille, {from:escrow});

    await factory.createSimpleProduct(Price1, 0, true, 0, 0, true, escrow, EscrowTime, false, "0x0", "Escrowed", "Phone", {from:vendor1});
    await factory.createSimpleProduct(Price1, 0, true, 0, 0, true, escrow, EscrowTimeLong, false, "0x0", "Escrowed2", "Phone", {from:vendor1});
    //affiliate for vendor2
    await factory.createSimpleProduct(Price1, 0, true, 0, 0, true, escrow, EscrowTime, false, affiliate, "EscrowAndAff", "Email", {from:vendor2});

    await payment.buyWithEth(0, 2, "MyEmail@gmail.com", false, Price1, {from:user2, value:Price1*2});
    await payment.buyWithEth(1, 2, "User@mail.ru", false, Price1, {from:user2, value:Price1*2});
    await payment.buyWithEth(1, 1, "ID1", true, Price1, {from:user1, value:Price1});

    await payment.complain(0, 0, {from:user2});
    await payment.complain(1, 1, {from:user1});

    await payment.resolve(0, 0, true, {from:escrow});
    await payment.resolve(1, 1, false, {from:escrow});

    // console.log("Cashback total");
    // console.log(await utils.getBalance(discountPolicy.address));
    await time.timeTravelAndMine(EscrowTime);
    await payment.withdrawPendingPayments([1],[1], {from:vendor1});
    //5520000000000000
    await discountPolicy.addCashbacks([user1, user2], [520000000000000, 120000000000000]);

    await utils.sendEther(owner, testSigner, 1000000000000000000);
    //
    //save info
    //
    console.log("Saving contracts");
    fs.writeFileSync("./deployed/test/all.json", JSON.stringify(info, null , '\t'));
    console.log("Contracts saved");
}