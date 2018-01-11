var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Fund = artifacts.require("EtherFund");
var Token = artifacts.require("BCSToken");
var BToken = artifacts.require("BCSBonusToken");
var Store = artifacts.require("BonusStore");
var Generator = artifacts.require("BonusTokenGenerator");

var CheckList = artifacts.require("CheckList");
var Vendor = artifacts.require("Vendor");
var ProductDispatcherStorage = artifacts.require("ProductDispatcherStorage");
var ProductEngine = artifacts.require("ProductEngine");
var ProductEngineTest = artifacts.require("ProductEngineTest");
var Product = artifacts.require("Product");
var VendorManager = artifacts.require("VendorManager");
var VendorFactory = artifacts.require("VendorFactory");

const ProviderFee = 100;
var OneBCS;
const OneEther = 1000000000000000000;
const TokenCap = 1000;
const BonusEtherRate = 1000;
const BonusTokenPrice = 1;
const ShareGen = 800;
const ShareOwner = 200;
const GasPrice = 20000000000;

//returns real tokens amount considering token decimals
async function _RT(_token, _tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_token, _holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await _token.balanceOf.call(_holder)).toNumber());
    })
}

function GeneratorShare(ether) {
    return (ether * ShareGen) / 1000;
}

function BonusTokensFor(generatorBalance, tokenAmount) {
    return (generatorBalance * tokenAmount / TokenCap) * BonusEtherRate;
}

function GeneratorFundShareFor(purchaseCost) {
    return  purchaseCost*ShareGen*ProviderFee/(1000*1000);
}

function TopicToAddress(topic) {
    return topic.replace("0x000000000000000000000000","0x");
}

contract("BonusStore", function(accounts) {
    var owner = accounts[0];
    var user1 = accounts[1];
    var user2 = accounts[2];
    var user3 = accounts[3];
    var user4 = accounts[4];
    var spender = accounts[5];
    var provider = accounts[6];
    var vendorWallet = accounts[7];
    var fund;
    var token;
    var btoken;    
    var store;
    var allowedProducts;
    var gen, gen2;
    var tokens1 = 100;
    var tokens2 = 200;
    var tokens3 = 300;    
    var issue1, issue2, issue3;    
    var engine;
    var vendor, product1, product2, manager, factory;    
    var price1 = OneEther / 2;
    var price2 = OneEther / 10;    
    var price3 = OneEther / 10000;
    
    it("create tokens, and transfer them", async function() {
        token = await Token.new(TokenCap, 18);
        await token.setLockedState(false);
        OneBCS = await _RT(token, 1);

        btoken = await BToken.new("BCB Token", "BCB", 18);        

        await token.transfer(user1, await _RT(token, tokens1));
        await token.transfer(user2, await _RT(token, tokens2));
        await token.transfer(user3, await _RT(token, tokens3));        
    })

    it("create generator and store, setup tokens", async function() {
        allowedProducts = await CheckList.new();
        gen = await Generator.new(token.address, btoken.address, BonusEtherRate, BonusTokenPrice);
        gen2 = await Generator.new(token.address, btoken.address, BonusEtherRate, BonusTokenPrice);
        fund = await Fund.new(gen.address, ShareGen, owner, ShareOwner);        
        store = await Store.new(gen.address, allowedProducts.address);
        await gen.setEtherSpender(spender, true);

        await gen.setFund(fund.address);
        await gen.setEtherSpender(store.address, true);
        await btoken.setMinter(gen.address, true);
        await token.setValueAgent(gen.address);
        await token.setReturnAgent(gen.address);
        await gen.setReturnableToken(token.address);
    })

    it("create platform, vendor and products", async function() {
        engine = await ProductEngine.new();        
        storage = await ProductDispatcherStorage.new(engine.address);        
        
        var ProductLibDispatcher = artifacts.require("LibDispatcher");
        ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            storage.address.slice(2));        
        dispatcher = await ProductLibDispatcher.new();
        
        Product.link('IProductEngine', dispatcher.address);
        VendorFactory.link('IProductEngine', dispatcher.address);

        manager = await VendorManager.new(fund.address, ProviderFee);

        factory = await VendorFactory.new(manager.address, allowedProducts.address);        
        await manager.setFactory(factory.address, true);
        await allowedProducts.setManager(factory.address, true);

        assert.isTrue(await manager.validFactory.call(factory.address), "Invalid factory in manager");        
        assert.equal(await factory.manager.call(), manager.address, "Invalid manager in factory");

        var txr = await factory.createVendor(vendorWallet, "Vendor1", {from: vendorWallet});
        vendor = Vendor.at(txr.logs[0].args.vendor);

        var txr = await factory.createProduct(vendor.address, "Product1", price1, 0, {from:vendorWallet});
        product = Product.at(txr.logs[0].args.product);

        var txr = await factory.createProduct(vendor.address, "Product2", price2, 0, {from:vendorWallet});
        product2 = Product.at(txr.logs[0].args.product);

        var txr = await factory.createProduct(vendor.address, "Product3", price3, 0, {from:vendorWallet});
        product3 = Product.at(txr.logs[0].args.product);

        assert.equal(await product.owner.call(), vendor.address, "invalid product's owner");
    })    

    it("purchase product1, check bonus tokens", async function() {
        var txr = await product.buy("buy1", false, price1, {from:user1, value:price1});
        
        var etherReceivedEventData = Object.keys(Fund.events)[1];
        var productBoughtEventData = Object.keys(Product.events)[0];

        assert.equal(await product.getTotalPurchases.call(), 1, "Product1 should get 1 purchase");
        
        assert.equal(txr.receipt.logs[0].topics[0], etherReceivedEventData, "EtherFund.EtherReceived event should be emitted first");
        assert.equal(txr.receipt.logs[1].topics[0], productBoughtEventData, "Product.ProductBought event should be emitted second");

        assert.equal(await fund.etherBalanceOf.call(gen.address), GeneratorFundShareFor(price1), "invalid ether for bonuses");
        assert.equal((await web3.eth.getBalance(fund.address)).toNumber(), price1*ProviderFee/1000, "Invalid fund's balance");
    })
    
    it("check bonus tokens for users", async function() {
        var balance = await fund.etherBalanceOf.call(gen.address);
        assert.equal(await gen.bonusTokensToIssue(user1), BonusTokensFor(balance, tokens1), "Invalid bonuses for user1");
        assert.equal(await gen.bonusTokensToIssue(user2), BonusTokensFor(balance, tokens2), "Invalid bonuses for user2");
        issue1 = await gen.bonusTokensToIssue(user1);
        issue2 = await gen.bonusTokensToIssue(user2);
    })

    it("withdraw bonuses for user1", async function() {
        await token.transfer(gen.address, OneBCS, {from:user1});
        assert.equal(await _TB(btoken, user1), issue1, "Invalid bonuses received by user1");        
        assert.equal(await gen.bonusTokensToIssue(user1), 0, "Should be 0 bonuses for user1");

        assert.equal((await btoken.totalSupply.call()).toNumber(), issue1.toNumber(), "Invalid BCB token supply");
    })

    it("try to buy without approve, should fail", async function() {
        try {
            var txr = await store.buy(product3.address, "buystore", 1, price3, {from:user1});
        } catch (e) {
            return true;
        }
        throw "Purchase should fail";
    })
    
    it("buy with bonuses", async function() {
        var btokens1 = await _TB(btoken,user1);
        await btoken.approve(store.address, btokens1, {from:user1});
        
        var tx = await store.buy(product3.address, "buystore", 1, price3, {from:user1});
        var purchase = await product3.getPurchase.call(0);
        assert.equal(await product3.getTotalPurchases.call(), 1, "Product3 should get 1 purchase");
        assert.equal(purchase[1].toString(), store.address, "Product's purchaser address should be equal to store");        
        assert.equal(purchase[2].toString(), "buystore", "Product's clientid should be equal to 'buystore'");        
        
        var innerEventData = Object.keys(Product.events)[0];
        assert.equal(Product.events[innerEventData].name, "ProductBoughtEx", "First Product contract event should be ProductBoughtEx");

        var innerProductBoughtEvent = tx.receipt.logs[5];
        assert.equal(innerProductBoughtEvent.topics[0], innerEventData, "Invalid inner event index");
        assert.equal(store.address, 
            TopicToAddress(innerProductBoughtEvent.topics[2]), 
            "Store address should be stored in inner event as purchaser");

        assert.equal(tx.logs[0].event, "ProductBought", "ProductBought event should be emitted");
        assert.equal(tx.logs[0].args.buyer, user1, "User1 address should be in Store.ProductBought event");            
    })

    it("bonus tokens total supply should be less", async function() {
        assert.equal(await btoken.totalSupply.call(), issue1 - price3*BonusEtherRate, "Invalid BCB token supply");
    })

    it("try to set active as not an owner, should fail", async function() {
        try {
            await store.setActive(false, {from:user2});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })

    it("set active to false", async function() {
        await store.setActive(false);
        assert.isFalse(await store.isActive.call(), "Store should be inactive now");
    })

    it("try to buy with bonuses, should fail", async function() {
        try {
            await store.buy(product3.address, "buystore2", 1, price3, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })

    it("set active back to true and buy", async function() {
        await store.setActive(true);
        assert.isTrue(await store.isActive.call(), "Store should be active now");
            
        var txr = await store.buy(product3.address, "buystore", 1, price3, {from:user1});
        assert.equal(await product3.getTotalPurchases.call(), 2, "Product3 should get 2 purchases");
        assert.equal(await btoken.totalSupply.call(), issue1 - 2*price3*BonusEtherRate, "Invalid BCB token supply");
    })



    it("try to buy fake product, should fail", async function() {
        var FakeProduct = artifacts.require("FakeProduct");
        var fakeProduct = await FakeProduct.new(vendor.address, user3, "FAKE", price3, {from:user3});
        var oldBalance = web3.eth.getBalance(user3);
        var btokensUser1 = await _TB(btoken, user1);
        //console.log(btokensUser1);
        assert.isAtLeast(btokensUser1, BonusEtherRate*price3, "!");
        try {
            await store.buy(fakeProduct.address, "buyfake", 1, price3, {from:user1});
            var newBalance = web3.eth.getBalance(user3);
            assert.equal(newBalance.minus(oldBalance), price3, "Profit goes to beneficiary, that's bad");
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })



    it("check real buyer from the first purchase", async function() {
        var purchase = await product3.getPurchase.call(0);
        assert.equal(purchase[0], 0, "This should be the first purchase");
        
        //get transaction of this purchase
        var event = product3.ProductBoughtEx({id:purchase[0]}, {fromBlock:0,toBlock:'latest'});
        event.get(function(err, result) {
            
            assert.equal(result[0].args.buyer, store.address, "Invalid buyer in event");
            assert.equal(result[0].args.clientId, "buystore", "Invalid client id in event");

            //check this transaction (not receipt!) for inner events
            var tx = web3.eth.getTransactionReceipt(result[0].transactionHash);
            var storeEvent = tx.logs[6];
            
            assert.equal(storeEvent.topics[0], Object.keys(Store.events)[0], "Event should be Store.ProductBought");
            assert.equal(TopicToAddress(storeEvent.topics[1]), user1, "Real buyer should be user1");
            assert.equal(TopicToAddress(storeEvent.topics[2]), product3.address, "Invalid product");          
        })
    })

    it("try to set token generator as not an owner, should fail", async function() {
        try {
            await store.setTokenGenerator(gen2.address, {from:user3});
        } catch(e) {
            return true;
        }
        throw "Generator change should fail";
    })

    it("set token generator", async function() {
        await store.setTokenGenerator(gen2.address);
        assert.equal(await store.generator.call(), gen2.address, "Invalid token generator for store");
    })    
})