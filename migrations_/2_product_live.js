let fs = require("fs");

let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("../test/utils.js"))(web3);
let time = new (require("../test/timeutils.js"))(web3);

let ProductStorage = artifacts.require("ProductStorage");
let ProductMaker = artifacts.require("ProductMaker");
let Token = artifacts.require("BCSToken");
let EtherFund = artifacts.require("EtherFund");
let ProxyFund = artifacts.require("ProxyFund");
let FeePolicy = artifacts.require("FeePolicy");
let DiscountPolicy = artifacts.require("DiscountPolicy");
let ProductPayment = artifacts.require("ProductPayment");
let EtherPriceProvider = artifacts.require("EtherPriceProvider");
let TokenCap = 10000;
let TokenDecimals = 18;
let OneEther = 1000000000000000000;
let Price1 = OneEther/100;
let ProfitPermille = 200;
let DiscountPermille = 800;
let MinPoolForDiscount = OneEther / 1000;
let DiscountsInPool = 10;
let MaxDiscount = 300; //=30%
let MinTokensForDiscount = 10000000000000000000; //10 bcs

let MinTokensForFeeDiscount = 10000000000000000000; //10 bcs
let FeePermille = 100;
let EscrowFeePermille = 50;
let FiatPriceFeePermille = 50;
let FeeDiscountTerm = 86400; //1 day
let MaxTotalDiscount = OneEther;
let FeeDiscountPermille = 600;
let EscrowTime = 3600; //1 hour

module.exports = async function(deployer, network, accounts) {
    let info = {
        storage: {},
        factory: {},
        token: {},
        feePool: {},
        discountPool: {},
        feePolicy: {},
        discountPolicy: {},
        payment: {},
        etherPrice: {},
        bcsConverter: {},
        bntConverter: {},
        bntToken: {},
        ethToken: {},
        relayToken: {}
    };

    let owner = accounts[0];
    let provider = accounts[1];
    let escrow = accounts[2];
    let user1 = accounts[3];
    let user2 = accounts[4];
    let vendor1 = accounts[5];
    let vendor2 = accounts[6];
    let vendor3 = accounts[7];
    let vendor4 = accounts[8];
    let vendor5 = accounts[9];

    let bancorOwner = accounts[7];

    let storage;
    let factory;
    let token;
    let feePool;
    let discountPool;
    let feePolicy;
    let discountPolicy;
    let payment;
    let etherPrice;

    deployer.deploy(ProductStorage).then(function() {        
        return ProductStorage.deployed();
    }).then(function(storageDeployed) {
        storage = storageDeployed;        
        info.storage.address = storage.address;
        info.storage.block = web3.eth.blockNumber;
        info.storage.abi = ProductStorage.abi;        
        return deployer.deploy(Token, TokenCap, TokenDecimals);
    }).then(function() {
        return Token.deployed();
    }).then(function(tokenDeployed) {
        token = tokenDeployed;
        info.token.address = token.address;
        info.token.block = web3.eth.blockNumber;
        info.token.abi = Token.abi;
        return deployer.deploy(ProductMaker, storage.address);
    }).then(function() {
        return ProductMaker.deployed();
    }).then(function(factoryDeployed) {
        factory = factoryDeployed;
        info.factory.address = factory.address;
        info.factory.block = web3.eth.blockNumber;
        info.factory.abi = factory.abi;        
    }).then(function() {
        return deployer.deploy(ProxyFund);
    }).then(function() {
        return ProxyFund.deployed();
    }).then(function(fundDeployed) {
        discountPool = fundDeployed;
        info.discountPool.address = discountPool.address;
        info.discountPool.block = web3.eth.blockNumber;
        info.discountPool.abi = discountPool.abi;
    }).then(function() {
        return deployer.deploy(EtherFund, discountPool.address, 1000 - ProfitPermille, provider, ProfitPermille);
    }).then(function() {
        return EtherFund.deployed();
    }).then(function(fundDeployed) {
        feePool = fundDeployed;
        info.feePool.address = feePool.address;
        info.feePool.block = web3.eth.blockNumber;
        info.feePool.abi = feePool.abi;
    }).then(function() {
        return deployer.deploy(DiscountPolicy, MinPoolForDiscount, DiscountsInPool, MaxDiscount, 
                                discountPool.address, token.address, MinTokensForDiscount);
    }).then(function() {
        return DiscountPolicy.deployed();
    }).then(function(discountPolicyDeployed) {
        discountPolicy = discountPolicyDeployed;
        info.discountPolicy.address = discountPolicy.address;
        info.discountPolicy.block = web3.eth.blockNumber;
        info.discountPolicy.abi = discountPolicy.abi;
    }).then(function() {
        return deployer.deploy(FeePolicy, storage.address, FeePermille, EscrowFeePermille, FiatPriceFeePermille, feePool.address, token.address, 
                                MinTokensForFeeDiscount, FeeDiscountTerm, MaxTotalDiscount, FeeDiscountPermille);
    }).then(function() {
        return FeePolicy.deployed();
    }).then(function(feePolicyDeployed) {
        feePolicy = feePolicyDeployed;
        info.feePolicy.address = feePolicy.address;
        info.feePolicy.block = web3.eth.blockNumber;
        info.feePolicy.abi = feePolicy.abi;
    }).then(function() {
        return deployer.deploy(EtherPriceProvider);
    }).then(function() {
        return EtherPriceProvider.deployed();
    }).then(function(etherPriceDeployed) {
        etherPrice = etherPriceDeployed;
        info.etherPrice.address = etherPrice.address;
        info.etherPrice.block = web3.eth.blockNumber;
        info.etherPrice.abi = etherPrice.abi;
    }).then(function() {
        return deployer.deploy(ProductPayment, storage.address, feePolicy.address, discountPolicy.address, 
                                token.address, etherPrice.address, EscrowTime);
    }).then(function() {
        return ProductPayment.deployed();
    }).then(function(paymentDeployed) {
        payment = paymentDeployed;
        info.payment.address = payment.address;
        info.payment.block = web3.eth.blockNumber;
        info.payment.abi = payment.abi;
    }).then(async function(){
        //1eth = 1000$
        await etherPrice.updateRate(10000000000000);

        let tokens = 1000000000000000000;
        await token.setLockedState(false);
        await token.transfer(accounts[1], tokens);
        await token.transfer(accounts[2], 2 * tokens);
        await token.transfer(accounts[3], 30 * tokens);

        await discountPool.setBaseFund(feePool.address);

        await storage.setManager(factory.address, true);    
        await storage.setManager(payment.address, true);
        await storage.setVendorInfo(vendor1, vendor1, 19);
        
        await discountPool.setManager(discountPolicy.address, true);
        await discountPolicy.setManager(payment.address, true);
        await feePolicy.setManager(payment.address, true); 
        
        let bancorData = await utils.createBancor(bancorOwner, owner, token, payment, artifacts);
        info.bcsConverter.address = bancorData.bcsConverter.address;
        info.bcsConverter.abi = bancorData.bcsConverter.abi;
        info.bntConverter.address = bancorData.bntConverter.address;
        info.bntConverter.abi = bancorData.bntConverter.abi;
        info.bntToken.address = bancorData.bntToken.address;
        info.bntToken.abi = bancorData.bntToken.abi;
        info.ethToken.abi = bancorData.ethToken.abi;
        info.ethToken.address = bancorData.ethToken.address;
        info.relayToken.address = bancorData.relayToken.address;
        info.relayToken.abi = bancorData.relayToken.abi

        fs.writeFileSync("products.json", JSON.stringify(info, null , '\t'));


        //
        // Create lots of products
        //
        let prices = [
            OneEther/100, 
            5 * OneEther/1000, 
            2 * OneEther/100, 
            OneEther, 
            5 * OneEther/100, 
            10 * OneEther, 
            2 * OneEther, 
            3*OneEther/10, 
            10, 
            100
        ];

        let currentTime = time.currentTime();
        let maxUnits = [0, 0, 0, 0, 0, 0, 0, 1, 4, 10];
        let startTime = [0, 0, 0, 0, 0, 0, 0, currentTime + 3600, currentTime + 86400 / 2, currentTime + 7 * 86400];
        let endTime = [0, 0, 0, currentTime + 30 * 86400, 0, currentTime + 86400, 0, currentTime + 3600*10, currentTime + 50*86400, 0];
        let contacts = ["Email", "Telegram", "Email","Email|Nickname", "Skype", "Email|Skype", "Email", "Email|Telegram", "Email", "Telegram|Skype"];
        
        let productsCounts = [100, 200, 10, 5, 50];
        let vendors = [vendor1, vendor2, vendor3, vendor4, vendor5];
                
        for(let i = 0; i < productsCounts.length; ++i) {
            let currentVendor = vendors[i];
            
            await factory.setVendorWallet(currentVendor, {from:currentVendor});
            
            for(let j = 0; j < productsCounts[i]; ++j) {
                let index = j%10;
                await factory.createSimpleProduct(
                    prices[index], 
                    maxUnits[index], 
                    true, 
                    startTime[index], 
                    endTime[index], 
                    j != 1 && j != 5, 
                    j == 8 || j == 9, 
                    `Product-${i}-${j}`, 
                    contacts[index], 
                    {from:currentVendor}
                );
            }
        }


        //
        // Buy lots of products
        //

        let customers = [user1, user2, escrow, provider];
        let paymentsCount = [10, 50, 20, 40];
        let productIds = [
            0, 
            1, 
            2, 
            productsCounts[0], 
            productsCounts[0]+1,
            productsCounts[0]+2, 
            productsCounts[0]+productsCounts[1], 
            productsCounts[0]+productsCounts[1]+1,
            productsCounts[0]+productsCounts[1]+2, 
            productsCounts[0]+productsCounts[1]+productsCounts[2]
        ];
        let unitsToBuy = [1,1,3,1,2,2,3,1,1,2];
    
        let currentPayment = 0;
        for(let i = 0; i < customers.length; ++i) {
            for(let j = 0; j < paymentsCount[i]; ++j) {
                let index = currentPayment%10;
                let pid = productIds[index];
                let currentPrice = (await storage.getProductPrice.call(pid)).toNumber();
                await payment.buyWithEth(
                    pid,
                    unitsToBuy[index],
                    `Contact-1-${i}|Contact-2-${i}|Contact-3-${i}`,
                    false,
                    currentPrice,
                    {from:customers[i], value:currentPrice*unitsToBuy[index]}
                );
                ++currentPayment;
            }
        }
        await time.timeTravelAndMine(EscrowTime);
        
        //
        // Create product with vendor wallet
        //
        await factory.createSimpleProductAndVendor(user1, Price1, 0, true, 0, 0, false, false, "ProductUser1", "Email", {from:user1});            
    });
}