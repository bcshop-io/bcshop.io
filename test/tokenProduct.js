let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let CheckList = artifacts.require("CheckList");
let Vendor = artifacts.require("Vendor");
let ProductDispatcherStorage = artifacts.require("ProductDispatcherStorage");
let ProductEngine = artifacts.require("ProductEngine");
let Product = artifacts.require("Product");
let TokenProduct = artifacts.require("TokenProduct");
let VendorManager = artifacts.require("VendorManager");
let VendorFactory = artifacts.require("VendorFactory");
let ProductFactory = artifacts.require("ProductFactory");
let Token = artifacts.require("CockToken");

let vendor, product, manager, factory, pfactory;
let owner, vendorWallet, provider, user1, user2, engine, dispatcher, storage;
let allowedProducts;
let token, tproduct;

const Fee = 100;
const Denominator = 1;
const OneEther = 1000000000000000000;
const Price = OneEther * 2;


async function _RTF(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve(_tokens * Math.pow(10, (await token.decimals.call()).toNumber()));
    });
}
//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}


async function _Name(p) {
    var data = await p.engine.call();
    //return web3.toUtf8(data[1]);
    return data[1];
}

async function _MaxUnits(p) {
    var data = await p.engine.call();
    return data[3].toNumber();
}

async function _SoldUnits(p) {
    var data = await p.engine.call();
    return data[5].toNumber();
}

async function _Price(p) {
    var data = await p.engine.call();
    return data[2].toNumber();
}

async function _IsActive(p) {
    var data = await p.engine.call();    
    return data[4];
}

async function _Denominator(p) {
    var data = await p.engine.call();    
    return data[6].toNumber();
}

contract("TokenProduct", function(accounts) {

    it("prepare platform", async function() {
        owner = accounts[0];
        vendorWallet = accounts[1];
        provider = accounts[2];
        user1 = accounts[3];
        user2 = accounts[4];
        user3 = accounts[5];

        token = await Token.new("Cock Token", "CT", 18);

        allowedProducts = await CheckList.new();
        engine = await ProductEngine.new();
        storage = await ProductDispatcherStorage.new(engine.address);
        
        let ProductLibDispatcher = artifacts.require("LibDispatcher");
        ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            storage.address.slice(2));        
        dispatcher = await ProductLibDispatcher.new();

        Product.link('IProductEngine', dispatcher.address);
        TokenProduct.link('IProductEngine', dispatcher.address);
        ProductFactory.link('IProductEngine', dispatcher.address);

        manager = await VendorManager.new(provider, Fee);
        factory = await VendorFactory.new(manager.address);        
        pfactory = await ProductFactory.new(manager.address, allowedProducts.address);        
        
        await allowedProducts.setManager(pfactory.address, true);       
        await manager.setFactory(factory.address, true);
        await manager.setFactory(pfactory.address, true);

        var tx = await factory.createVendor(vendorWallet, "Vendor1");
        vendor = Vendor.at(tx.logs[0].args.vendor);
        
        assert.isTrue(await manager.validFactory.call(factory.address), "Invalid factory in manager");        
        assert.equal(await factory.manager.call(), manager.address, "Invalid manager in factory");
    });

    it("create cocktoken product", async function() {
        tproduct = await TokenProduct.new("Cock Token Sale", Price, 0, token.address);
        let denominator = Math.pow(10, await token.decimals.call());
        assert.equal(await _Denominator(tproduct), denominator, "Invalid denominator");        
    });

    it("attach token product to the vendor", async function() {        
        await pfactory.addProduct(vendor.address, tproduct.address);
        await tproduct.transferOwnership(vendor.address);

        let productCount = await vendor.getProductsCount.call();        
        assert.equal(await tproduct.owner.call(), vendor.address, "Vendor should be product's owner");
        assert.equal(await vendor.products.call(productCount-1), tproduct.address, "Token product should be in vendor's list");
    });

    it("try to buy without setting minter, should fail", async function() {
        try {
            await tproduct.buy("FAIL", false, Price, {from:user1, value:Price});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("allow product to mint tokens", async function() {
        await token.setMinter(tproduct.address, true);
        assert.isTrue(await token.minters.call(tproduct.address));
    });

    it("buy 1 token", async function() {
        assert.equal(await _TB(user1), 0, "Balance should be 0 tokens");

        let oldProviderBalance = (await web3.eth.getBalance(provider)).toNumber();
        let oldVendorBalance = (await web3.eth.getBalance(vendorWallet)).toNumber();

        await tproduct.buy("1", false, Price, {from:user1, value:Price});
        assert.equal(await _TB(user1), await _RT(1), "Balance should be 1 token");

        assert.equal((await web3.eth.getBalance(provider)).toNumber(), 
                    oldProviderBalance + Price * Fee / 1000, 
                    "Invalid provider's share");
        assert.equal((await web3.eth.getBalance(vendorWallet)).toNumber(), 
                    oldVendorBalance + Price * (1000- Fee) / 1000, 
                    "Invalid provider's share");
    });

    it("buy 1/100 of token", async function() {
        let tokenBalance = await _TB(user2);
        await tproduct.buy("0.01", false, Price, {from:user2, value:Price/100});

        assert.equal(await _TB(user2), await _RTF(0.01), "Invalid tokens received");
    });

    it("try buy tokens less than possible", async function() {
        assert.isAbove(Price, await _RT(1), "Price should be less than 1");
        let details = await tproduct.calculatePaymentDetails.call(1, false);
        assert.equal(details[0].toNumber(), 0, "There should be 0 tokens to buy");

        try {
            await tproduct.buy("0", false, Price, {from:user2, value:1});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });
});