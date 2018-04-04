require("./utils.js");

var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var CheckList = artifacts.require("CheckList");
var Vendor = artifacts.require("Vendor");
var ProductDispatcherStorage = artifacts.require("ProductDispatcherStorage");
var ProductEngine = artifacts.require("ProductEngine");
var ProductEngineTest = artifacts.require("ProductEngineTest");
var Product = artifacts.require("Product");
var VendorManager = artifacts.require("VendorManager");
var VendorFactory = artifacts.require("VendorFactory");
var ProductFactory = artifacts.require("ProductFactory");

var vendor, vendor2, product, manager, factory, factory2, pfactory, pfactory2;
var Fee = 100;
var Price = 100;
var Denominator = 1;

var owner, vendorWallet, provider, user1, user2, engine, engine2, dispatcher, storage;
var allowedProducts;


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
    return data[6];
}

function getProducts(_vendor) {
    return new Promise((resolve, reject) => {
        var event = _vendor.ProductCreated({}, {fromBlock: 0, toBlock: 'latest'});
        event.get(function(error, result) {
            if(!error) {
                return resolve (result);
            }
        })    
    })
}

async function getProduct(_vendor, index) {
    var products = await getProducts(_vendor);   
    return products[index].args.product;
}


function getPurchases(_product) {
    return new Promise((resolve, reject) => {
        var event = _product.ProductBoughtEx({}, {fromBlock: 0, toBlock: 'latest'});
        event.get(function(error, result) {
            if(!error) {
                return resolve (result);
            }
        })    
    })
}

function getPurchaseDelivered(purchase) {
    return purchase[5];
}

function getPurchaseBadRating(purchase) {
    return purchase[6];
}

function getPurchasePrice(purchase) {
    return purchase[3];
}

function getPurchaseBuyer(purchase) {
    return purchase[1];
}

function getPurchaseId(purchase) {
    return purchase[0];
}

function getPurchaseClientid(purchase) {
    return purchase[2];
}

function getPurchaseUnits(purchase) {
    return purchase[4];
}

async function getPurchase(_product, index) {
    var purchases = await getPurchases(_product);   
    return purchases[index].args;
}

function Prepare(accounts, denominator) {
    return new Promise(async (resolve, reject) => {
        
        Denominator = denominator;
        owner = accounts[0];
        vendorWallet = accounts[1];
        provider = accounts[2];
        user1 = accounts[3];
        user2 = accounts[4];
        
        allowedProducts = await CheckList.new();
        //create engine
        engine = await ProductEngine.new();        
        storage = await ProductDispatcherStorage.new(engine.address);
        var ProductLibDispatcher = artifacts.require("LibDispatcher");
        ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            storage.address.slice(2));        
        dispatcher = await ProductLibDispatcher.new();

        ProductFactory.link('IProductEngine', dispatcher.address);
        
        manager = await VendorManager.new(provider, Fee);
        factory = await VendorFactory.new(manager.address);
        factory2 = await VendorFactory.new(manager.address);
        
        pfactory = await ProductFactory.new(manager.address, allowedProducts.address);
        pfactory2 = await ProductFactory.new(manager.address, allowedProducts.address);
        
        await allowedProducts.setManager(pfactory.address, true);
        await allowedProducts.setManager(pfactory2.address, true);
        await manager.setFactory(factory.address, true);
        await manager.setFactory(pfactory.address, true);

        var txr = await factory.createVendor(vendorWallet, "Vendor1");
        vendor = Vendor.at(txr.logs[0].args.vendor);
        return resolve(true);
    })    
}


contract("Platform base contracts", function(accounts) {
    it("CREATE. create all the base contracts", async function() {
        owner = accounts[0];
        vendorWallet = accounts[1];
        provider = accounts[2];
        user1 = accounts[3];
        user2 = accounts[4];
        user3 = accounts[5];

        allowedProducts = await CheckList.new();
        engine = await ProductEngine.new();
        engine2 = await ProductEngineTest.new();
        storage = await ProductDispatcherStorage.new(engine.address);
        
        var ProductLibDispatcher = artifacts.require("LibDispatcher");
        ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            storage.address.slice(2));        
        dispatcher = await ProductLibDispatcher.new();

        Product.link('IProductEngine', dispatcher.address);
        ProductFactory.link('IProductEngine', dispatcher.address);

        manager = await VendorManager.new(provider, Fee);
        factory = await VendorFactory.new(manager.address);
        factory2 = await VendorFactory.new(manager.address);

        pfactory = await ProductFactory.new(manager.address, allowedProducts.address);
        pfactory2 = await ProductFactory.new(manager.address, allowedProducts.address);
        
        await allowedProducts.setManager(pfactory.address, true);
        await allowedProducts.setManager(pfactory2.address, true);
        await manager.setFactory(factory.address, true);
        await manager.setFactory(pfactory.address, true);
        
        assert.isTrue(await manager.validFactory.call(factory.address), "Invalid factory in manager");
        assert.isFalse(await manager.validFactory.call(factory2.address), "Factory2 should not be valid");
        assert.equal(await factory.manager.call(), manager.address, "Invalid manager in factory");
    })

    it("CREATE. create vendor as user1 via factory", async function() {
        assert.equal(await manager.getVendorCount.call(user1), 0, "Should be no vendor contracts for user1");

        var txr = await factory.createVendor(vendorWallet, "Vendor1", {from: user1});        
        assert.equal(txr.logs[0].event, "VendorCreated", "Should be emitted 'VendorCreated' event");
        assert.equal(txr.logs[0].args.vendorOwner, user1, "Event's 'vendorOwner' arg should equal to user1");
                
        vendor = Vendor.at(txr.logs[0].args.vendor);        
        assert.equal(vendor.address, await manager.vendorLists.call(user1, 0), "Vendor addresses from logs and storage don't match");
        assert.equal(await vendor.owner.call(), user1, "Vendor's owner should be user1");
        assert.isTrue(await manager.validVendor.call(vendor.address), "Created vendor should be valid in manager");
        assert.equal(await manager.getVendorCount.call(user1), 1, "Should be 1 vendor contract for user1");
    })

    it("CREATE. try to call manager.addVendor as not factory", async function() {
        try {
            await manager.addVendor(user1, vendor.address);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "manager.addVendor should fail");
    })

    it("CREATE. create product", async function() {    
        var txr = await pfactory.createProduct(vendor.address, "Product1.1", 1000, 0, Denominator, {from:user1});
        assert.equal(txr.logs[0].event, "ProductCreated", "Should be emitted 'ProductCreated' event");
        assert.equal(txr.logs[0].args.vendor, vendor.address, "Event's 'vendor' arg should equal to vendor contract");

        product = Product.at(txr.logs[0].args.product);        
        var products = await getProducts(vendor);
        var productFromArray = await getProduct(vendor, 0);
        assert.equal(productFromArray, product.address, "Product addresses from logs and vendor don't match");
        assert.equal(products.length, 1, "Vendor1 should have 1 product");
        assert.equal(await product.owner.call(), vendor.address, "Product's owner should be vendor contract");

        //storage system
        assert.equal(await vendor.getProductsCount.call(), 1, "Vendor should have 1 product in storage");
    })

    it("CREATE. try change product's owner, should fail", async function() {
        try {
            await product.transferOwnership(user3, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    })

    it("DISABLE VENDOR. disable", async function() {        
        await manager.setValidVendor(vendor.address, false);
        assert.isFalse(await manager.validVendor.call(vendor.address), "Vendor should be invalid in manager");        
    })

    it("DISABLE VENDOR. try to create product, should fail", async function() {
        try {
            await factory.createProduct(vendor.address, "Invalid Product", 2000, 0, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Product createion should fail");
    })

    it("DISABLE VENDOR. enable vendor back", async function() {        
        await manager.setValidVendor(vendor.address, true);
        assert.isTrue(await manager.validVendor.call(vendor.address), "Vendor should be invalid in manager");        
    })

    it("DISABLE VENDOR. try to disable vendor as not owner, should fail", async function() {
        try {
            await manager.setValidVendor(vendor.address, false, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Fail to disabel vendor, not manager's owner");
    })

    it("CREATE. create one more product", async function() {
        var txr = await pfactory.createProduct(vendor.address, "Product1.2", 2000, 0, Denominator, {from:user1});
        
        var product2 = Product.at(txr.logs[0].args.product);//Product.at(await vendor.products.call(1));
        assert.equal(await product2.owner.call(), vendor.address, "Product's owner should be vendor contract");
        var products = await getProducts(vendor);
        assert.equal(products.length, 2, "Vendor1 should have 2 products");

        assert.equal(await getProduct(vendor, 0), product.address, "1st product in events array should be 1st created");
        assert.equal(await getProduct(vendor, 1), product2.address, "2nd product in events array should be 2nd created");        

        //storage system
        assert.equal(await vendor.getProductsCount.call(), 2, "Vendor should have 2 product in storage");
        assert.equal(await vendor.products.call(1), product2.address, "2nd product in storage array should be 2nd created");        
    })

    it("CREATE. create product as not vendor's owner, should fail", async function() {
        try {
            var txr = await factory.createProduct(vendor.address, "Product1", 1000, 0, {from:user2});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Product creation should fail, wrong owner");
    })    

    it("CREATE. create vendor from constructor, should fail to create product with factory then", async function() {
        var alienVendor = await Vendor.new(manager.address, "ALIEN", user3, 0, {from:user3});
        assert.isFalse(await manager.validVendor.call(alienVendor.address), "Vendor should be invalid");

        try {
            await factory.createProduct(alienVendor.address, "ALIEN Product", 2000, 0, {from:user3});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Product creation should fail");
    })

    let alienVendor, alienProduct;
    it("CREATE. create vendor and product from constructors, 'buy' fails as owner isn't VendorBase", async function() {
        alienVendor = await Vendor.new(manager.address, "ALIEN", /*user3,*/ user3, 0, {from:user3});
        alienProduct = await Product.new("ALIENP", 1500, 0, Denominator, {from:user3});

        try {
            await alienProduct.buy("!", false, 1500, {value: 1500});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Alien product 'buy' should fail");
    })

    it("ATTACH. attach as not owner", async function() {
        try {
            await pfactory.addProduct(vendor.address, alienProduct.address, {from:user1});        
        } catch (e) {
            return true;
        }
        throw "Should fail";
    })

    it("ATTACH. attach constructed product to vendor", async function() {
        await pfactory.addProduct(vendor.address, alienProduct.address);
        
        await alienProduct.transferOwnership(vendor.address, {from:user3});

        let productsCount = await vendor.getProductsCount.call();
        assert.equal(await vendor.products.call(productsCount-1), alienProduct.address, "Constructed product should be in vendor list");
    });

    it("ATTACH. buy constructed product", async function() {
        await alienProduct.buy("!", false, 1500, {value: 1500});
        assert.equal(await alienProduct.getTotalPurchases.call(), 1, "There should be 1 purchase");
    });

    it("DISABLE MANAGER. disable manager", async function() {
        assert.isTrue(await manager.active.call(), "Manager state should be active now");
        await manager.setActive(false); 

        assert.isFalse(await manager.active.call(), "Manager state should be inactive now");
    })

    it("DISABLE MANAGER. try to create vendor, should fail", async function() {
        try {
            await factory.createVendor(vendorWallet, "Vendor fail", {from: user2});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Usage of factory should fail, manager disabled");
    })

    it("DISABLE MANAGER. try to create product, should fail", async function() {        
        try {
            await factory.createProduct(vendor.address, "Product1", 1000, 0, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Usage of factory should fail, manager disabled");
    })

    it("DISABLE MANAGER. enable manager back", async function() {
        await manager.setActive(true); 
        
        assert.isTrue(await manager.active.call(), "Manager state should be active now");
    })

    it("DISABLE MANAGER. try to disable manager as not owner", async function() {
        try {
            await manager.setActive(false, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Manager disable should fail, not owner");
    })

    var vendorC;
    it("CUSTOM VENDOR. create custom vendor", async function() {
        var txr = await factory.createCustomVendor(user3, user2, "Custom", 50);
        vendorC = Vendor.at(txr.logs[0].args.vendor);

        assert.equal(await vendorC.name.call(), "Custom", "Invalid sustom vendor name");
        assert.equal(await vendorC.owner.call(), user3, "Invalid custom vendor's owner");
        assert.equal(await vendorC.vendor.call(), user2, "Invalid custom vendor's wallet");
        assert.equal(await vendorC.providerFeePromille.call(), 50, "Invalid custom vendor's fee");

        assert.equal(await manager.vendorLists.call(user3, 0), vendorC.address, "User3 vendorlists should contain new contract");
    })

    it("CUSTOM VENDOR. create custom vendor's product and buy", async function() {

        var txr = await pfactory.createProduct(vendorC.address, "Custom Product", 2000, 0, Denominator, {from:user3});
        var product = Product.at(txr.logs[0].args.product);        

        var balance1 = await web3.eth.getBalance(user2);
        var pbalance1 = await web3.eth.getBalance(provider);

        await product.buy("cidcid", false, 2000, {value:2000});

        var balance2 = await web3.eth.getBalance(user2);
        var pbalance2 = await web3.eth.getBalance(provider);

        assert.equal(balance2.minus(balance1).toNumber(), 1900, "User2 (vendor wallet) should get 1900");
        assert.equal(pbalance2.minus(pbalance1).toNumber(), 100, "Provider should get 100 (5%)");
    })

    it("CUSTOM VENDOR. try to create custom vendor as not owner, should fail", async function(){        
        try {
            var txr = await factory.createCustomVendor(user3, user2, "Custom", 50, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Create custom vendor should fail");
    })

    it("CHANGE FACTORY. try to change factory as not owner, should fail", async function() {
        try {
            await manager.setFactory(factory2.address, true, {from: user2});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Factory change should fail");
    })

    it("CHANGE FACTORY. add new factory", async function() {        
        await manager.setFactory(factory2.address, true);
        await manager.setFactory(pfactory2.address, true);
        
        assert.isTrue(await manager.validFactory.call(factory2.address), "Invalid vendor factory in manager");        
        assert.isTrue(await manager.validFactory.call(pfactory2.address), "Invalid product factory in manager");        
        assert.equal(await factory2.manager.call(), manager.address, "Invalid manager in factory");
    })

    it("CHANGE FACTORY. still we are able to use old factory", async function() {
        var txr = await factory.createVendor(vendorWallet, "Vendor1");
        var vendor3 = Vendor.at(txr.logs[0].args.vendor);

        txr = await pfactory.createProduct(vendor3.address, "Product1.2", 2000, 0, Denominator);
        
        var product3 = Product.at(txr.logs[0].args.product);        
        var products = await getProducts(vendor3);
        assert.equal(products.length, 1, "New Vendor should have 1 product");
    })

    it("CHANGE FACTORY. disable old factory", async function() {
        await manager.setFactory(factory.address, false);
        await manager.setFactory(pfactory.address, false);
        assert.isFalse(await manager.validFactory.call(factory.address), "Old vendor factory should be invalid");
        assert.isFalse(await manager.validFactory.call(pfactory.address), "Old product factory should be invalid");
    })

    it("CHANGE FACTORY. try to use old factory to create vendor, should fail", async function() {
        try {
            await factory.createVendor(vendorWallet, "Vendor fail", {from: user2});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Usage of old factory should fail");
    })

    it("CHANGE FACTORY. try to use old factory to create product, should fail", async function() {        
        try {
            await pfactory.createProduct(vendor.address, "Product1", 1000, 0, Denominator, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Usage of old factory should fail");
    })

    it("CHANGE FACTORY. create vendor via new factory2", async function() {
        var txr = await factory2.createVendor(vendorWallet, "Vendor2", {from: user2});

        vendor2 = Vendor.at(txr.logs[0].args.vendor);
        assert.equal(vendor2.address, await manager.vendorLists.call(user2, 0), "Vendor addresses from logs and storage don't match");
        assert.equal(await vendor2.owner.call(), user2, "Vendor's owner should be user2");
        assert.isTrue(await manager.validVendor.call(vendor2.address), "Created vendor should be valid in manager");
        assert.equal(await manager.getVendorCount.call(user2), 1, "Should be 1 vendor contract for user2");
    })   

    it("CHANGE FACTORY. create product via new factory2 on new vendor", async function() {
        var txr = await pfactory2.createProduct(vendor2.address, "Product2.1", 1000, 0, Denominator, {from:user2});        

        var product2 = Product.at(txr.logs[0].args.product);

        var products = await getProducts(vendor2);
        assert.equal(products.length, 1, "Vendor2 should have 1 product");
        assert.equal(await product2.owner.call(), vendor2.address, "Product's owner should be vendor contract");
    })

    it("CHANGE FACTORY. create product via new factory2 on old vendor", async function() {
        var txr = await pfactory2.createProduct(vendor.address, "Product1.3", 3000, 20, Denominator, {from:user1});
        
        var product2 = Product.at(txr.logs[0].args.product); //Product.at(await vendor.products.call(2));        
        assert.equal(await _Price(product2), 3000, "Price should equal to 3000");

        var products = await getProducts(vendor);
        assert.equal(products.length, 4, "Vendor1 should have 4 products");
    })

    it("BUY. buy product", async function() {
        var details = await product.calculatePaymentDetails.call(2100, false);
        assert.equal(details[0].toNumber(), 2, "Should be able to purchase 2 units");
        assert.equal(details[1].toNumber(), 2000, "Will pay 2000");
        assert.equal(details[2].toNumber(), 100, "Will have overpay 100");

        var txr = await product.buy("myid", false, 1000, {value: 2100});
        assert.equal(await _SoldUnits(product), 2, "Should have sold 2 unit");
        assert.equal((await product.getTotalPurchases.call()).toNumber(), 1, "Product should have 1 purchase");
        assert.equal((await product.getPendingWithdrawal.call(owner)).toNumber(), 100, "Should have overpay 100");        

        var purchase = await getPurchase(product, 0);
        assert.equal(purchase.paidUnits.toNumber(), 2, "Purchase should contain 2 units");
        assert.equal(purchase.clientId, "myid", "Invalid purchase's client id");
    })



    it("CHANGE PROVIDER. try to change provider and fee as not owner, should fail", async function(){
        try {
            await manager.setParams(user1, 500, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Shouldn't be able to change params");
    })

    it("CHANGE PROVIDER. change provider and fee", async function() {
        await manager.setParams(user1, 500);
        assert.equal(await manager.provider.call(), user1, "Fee should go to user1");
        assert.equal(await manager.providerFeePromille.call(), 500, "Fee should be 50%");
    })

    it("CHANGE PROVIDER. create vendor and product, then buy some, fee should go to new provider", async function() {
        var balance1 = await web3.eth.getBalance(user1);
        var pbalance1 = await web3.eth.getBalance(provider);

        var txr = await factory2.createVendor(owner, "Vendor1");
        var newVendor = Vendor.at(txr.logs[0].args.vendor);
        txr = await pfactory2.createProduct(newVendor.address, "Product1.2", 2000, 0, Denominator);        
        var newProduct = Product.at(txr.logs[0].args.product);//Product.at(await newVendor.products.call(0));    
        await newProduct.buy("111", true, 2000, {from:user2, value: 2000});

        var balance2 = await web3.eth.getBalance(user1);
        var pbalance2 = await web3.eth.getBalance(provider);
        assert.equal(balance2.minus(balance1).toNumber(), 1000, "User1 (new provider) should get 1000 as fee");
        assert.equal(pbalance2.minus(pbalance1).toNumber(), 0, "Previous provider should get 0");
    })

    it("CHANGE PROVIDER. try to buy existing product, vendor's current fee should go to new provider", async function() {
        var balance1 = await web3.eth.getBalance(user1);
        var pbalance1 = await web3.eth.getBalance(provider);

        var product2 = Product.at(await vendor.products.call(1));
        
        await product2.buy("TEST", false, 2000, {value: 2000});
        assert.equal(await _SoldUnits(product2), 1, "Product should have 1 sold unit");        

        var balance2 = await web3.eth.getBalance(user1);
        var pbalance2 = await web3.eth.getBalance(provider);

        assert.equal(balance2.minus(balance1).toNumber(), 200, "User1 (new provider) should get 200 as fee (10%)");
        assert.equal(pbalance2.minus(pbalance1).toNumber(), 0, "Previous provider should get 0");
    })

    it("CHANGE PROVIDER. change provider and fee back", async function() {
        await manager.setParams(provider, Fee);
        assert.equal(await manager.provider.call(), provider, "Fee should go to provider");
        assert.equal(await manager.providerFeePromille.call(), Fee, "Fee should be 10%");
    })

    // it("CHANGE VENDOR's FEE. change vendor's fee to 30% as manager", async function() {
    //     await vendor.setFee(300);
    //     assert.equal(await vendor.providerFeePromille.call(), 300, "Fee should equal 30%");
    // })

    // it("CHANGE VENDOR's FEE. try to buy product, 30% should go to provider", async function() {
    //     var balance1 = await web3.eth.getBalance(vendorWallet);
    //     var pbalance1 = await web3.eth.getBalance(provider);

    //     var product2 = Product.at(await vendor.products.call(1));
        
    //     await product2.buy("TEST NEW FEE", false, 2000, {value: 2000});        

    //     var balance2 = await web3.eth.getBalance(vendorWallet);
    //     var pbalance2 = await web3.eth.getBalance(provider);

    //     assert.equal(balance2.minus(balance1).toNumber(), 1400, "Vendor wallet should get 1400");
    //     assert.equal(pbalance2.minus(pbalance1).toNumber(), 600, "provider should get 600");
    // })

    // it("CHANGE VENDOR's FEE. change vendor's fee as manager back", async function() {
    //     await vendor.setFee(Fee);
    //     assert.equal(await vendor.providerFeePromille.call(), Fee, "Fee should equal default");
    // })

    // it("CHANGE VENDOR's FEE. change vendor's fee as not a manager, should fail", async function() {
    //     try {
    //         await vendor.setFee(300, {from : user1});
    //     } catch(e) {
    //         return true;
    //     }
    // })


    it("LIBRARY. try to change library as not owner, should fail", async function() {
        try {
            await storage.replace(engine2.address, {from: user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Library change should fail");
    })    

    it("LIBRARY. change library", async function() {        
        await storage.replace(engine2.address);
        assert.equal(await storage.lib.call(), engine2.address, "New library should be engine2");
    })

    it("LIBRARY. check new 'calculatePaymentDetails' getter", async function() {
        var details = await product.calculatePaymentDetails.call(1237621, true);
        assert.equal(details[0].toNumber(), 10, "unitsToBuy should equal 10");
        assert.equal(details[1].toNumber(), 1237621, "etherToPay should equal 1237621");
        assert.equal(details[2].toNumber(), 0, "etherToReturn should equal 0");
    })

    it("LIBRARY. check new 'buy' function", async function() {
        var vBalance1 = await web3.eth.getBalance(vendorWallet);
        var pBalance1 = await web3.eth.getBalance(provider);
        var cBalance1 = await web3.eth.getBalance(product.address);

        //assert.equal((await product.getTotalPurchases.call()).toNumber(), 1, "Should be 1 purchases");

        await product.buy("c1", false, 1000, {from:user1, value: 143000});

        var vBalance2 = await web3.eth.getBalance(vendorWallet);
        var pBalance2 = await web3.eth.getBalance(provider);
        var cBalance2 = await web3.eth.getBalance(product.address);
        
        //everything should go to provider
        assert.equal(vBalance1.toNumber(), vBalance2.toNumber(), "Vendor should receive 0");
        assert.equal(pBalance2.minus(pBalance1).toNumber(), 143000, "Provider should receive all");

        assert.equal(await _SoldUnits(product), 12, "Product sold units should be increased by 10");
        assert.equal((await product.getTotalPurchases.call()).toNumber(), 2, "Should be 2 purchases");

        var purchase = await getPurchase(product, 1);
        assert.equal(purchase.paidUnits.toNumber(), 10, "paidUnits field should equal to 10 in new purchase");        
        assert.equal(cBalance1.toNumber(), cBalance2.toNumber(), "Product contract should leave no ether to itself");
    })

    it("LIBRARY. check old purchase", async function() {
        var purchase = await getPurchase(product, 0);
        assert.equal(purchase.paidUnits.toNumber(), 2, "paidUnits field should still equal to 2 in old purchase");
    })

    it("LIBRARY. try to 'buy' with amount little than requried by new library, should fail", async function() {
        try {
            await product.buy("12323", true, 1000, {from:user1, value:9000});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Payment should fail, low value");
    })

    // it("MIGRATION. Get all products from all vendors", async function () {
    //     console.log(owner);
    //     console.log(user1);
    //     console.log(user2);
    //     console.log(user3);

    //     console.log(factory.address);
    //     console.log(factory2.address);
    //     var tx = web3.eth.getTransaction(manager.transactionHash);
    //     //console.log(tx);
    //     //var firstBlock =  manager.transactionHash
    //     var event = manager.VendorAdded({}, {fromBlock: tx.blockNumber, toBlock:'latest'});
    //     event.get(function(err, result) {
    //         if(err) {
    //             console.log(err);
    //         } else {
    //             console.log(result);
    //         }
    //     })
    // })
})



contract("Product. Consecutive overpays", function(accounts) {
    var vBalance1, vBalance2, pBalance1, pBalance2;

    it("create product", async function() {
        await Prepare(accounts, 1);
        
        vBalance1 = await web3.eth.getBalance(vendorWallet);
        pBalance1 = await web3.eth.getBalance(provider);

        var txr = await pfactory.createProduct(vendor.address, "POverpay", Price, 0, Denominator);
        product = Product.at(txr.logs[0].args.product);
        
        assert.equal(await _Price(product), Price, "Price should equal 100");
        assert.equal(await _MaxUnits(product), 0, "Product should be unlimited");
        assert.equal(await _Denominator(product), 1, "Product's denominator should be 1");
    })

    it("check units to purchase", async function() {
        var res = await product.calculatePaymentDetails.call(Price+20, false);

        assert.equal(res[0].toNumber(), 1, "Should be able to buy 1 unit");
        assert.equal(res[1].toNumber(), Price, "Will pay 100");
        assert.equal(res[2].toNumber(), 20, "Will have overpay 20");        
    })

    it("buy 1 with small overpay", async function() {
        var txr = await product.buy("b1", false, Price, {from: user1, value: Price + 20});
       // console.log(txr);

        var data = await product.engine.call();        
        assert.equal(await _SoldUnits(product), 1, "Should have sold 1 unit");
        assert.equal((await product.getPendingWithdrawal.call(user1)).toNumber(), 20, "User1 should have overpay 20");
    })

    it("try buy sending 0, should fail", async function() {
        try {
            await product.buy("b1", false, Price, {from: user1, value: 0});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail, sent 0E - not enough");        
    })
    
    it("try buy sending less than Price", async function() {
        try {
            await product.buy("b1", false, Price, {from: user1, value: Price - 10});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail, amount sent is too low");
    })

    it("buy 2 with small overpay from the same user", async function() {
        await product.buy("b2", false, Price, {from: user1, value: 2 * Price + 30});
        var purchase = await getPurchase(product, 1);
        
        assert.equal(purchase.paidUnits.toNumber(), 2, "The latest purchase should be 2 units");
        assert.equal(await _SoldUnits(product), 3, "Should have sold 3 units total");
        assert.equal((await product.getPendingWithdrawal.call(user1)).toNumber(), 50, "User1 should have overpay 50");
    })

    it("buy 1 with no overpay from user2", async function() {
        await product.buy("b3", false, Price, {from: user2, value: Price});
        var purchase = await getPurchase(product, 2);

        assert.equal(purchase.paidUnits.toNumber(), 1, "The latest purchase should be 1 units");
        assert.equal(await _SoldUnits(product), 4, "Should have sold 4 units total");
        assert.equal((await product.getPendingWithdrawal.call(user2)).toNumber(), 0, "User2 should have overpay 0");
    })

    it("withdraw overpay from non-overpayer", async function() {
        var balance1 = await web3.eth.getBalance(product.address);
        await product.withdrawOverpay({from: user2});
        var balance2 = await web3.eth.getBalance(product.address);
        assert.equal(balance1.minus(balance2).toNumber(), 0, "Product balance should not be changed");
    })

    it("withdraw overpay from overpayer", async function() {
        var balance1 = await web3.eth.getBalance(product.address);
        await product.withdrawOverpay({from: user1});
        var balance2 = await web3.eth.getBalance(product.address);
        assert.equal(balance1.minus(balance2).toNumber(), 50, "Product balance should be less by 50");
        assert.equal(balance2.toNumber(), 0, "Product shouldn't contain ether now");
    })

    it("check vendor and provider balances", async function() {
        vBalance2 = await web3.eth.getBalance(vendorWallet);
        pBalance2 = await web3.eth.getBalance(provider);

        assert.equal(vBalance2.minus(vBalance1).toNumber(), 360, "Vendor should get 360");
        assert.equal(pBalance2.minus(pBalance1).toNumber(), 40, "Provider should get 40");
    })
})



contract("Product. Overpays and limited supply.", function(accounts) {
    var Limit = 10;
    it("create limited product, 10 units", async function() {
        await Prepare(accounts, 1);        
        var txr = await pfactory.createProduct(vendor.address, "PLimited", Price, Limit, Denominator);
        product = Product.at(txr.logs[0].args.product);// Product.at(await vendor.products.call(0));        
        assert.equal(await _MaxUnits(product), 10, "Product's limit should be 10");
    })

    it("buy 1", async function() {
        await product.buy("C1", true, Price, {from:user1, value: Price});
        assert.equal(await _SoldUnits(product), 1, "Should have sold 1 unit");
    })    

    it("buy 10, don't accept less, should fail", async function() {        
        try {
            await product.buy("C10", false, Price, {from:user2, value:Price*10});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");
    })

    it("buy 11, accept less, should result in overpay", async function() {
        await product.buy("C10", true, Price, {from:user2, value:Price*11});        
        assert.equal(await product.getTotalPurchases.call(), 2, "Should have 2 purchases");
        
        var purchase = await getPurchase(product, 1);
        assert.equal(purchase.paidUnits.toNumber(), 9, "The latest purchase is 9 units");

        assert.equal((await product.getPendingWithdrawal.call(user2)).toNumber(), Price * 2, "User2 should have overpay equal to price of 2 units");
    })

    it("no products left", async function() {
        assert.equal(await _SoldUnits(product), 
                    await _MaxUnits(product), 
                    "Should have sold max units");
    })

    it("try to buy 1, accept less, should fail", async function() {
        try {
            await product.buy("F1", true, Price, {from:user2, value:Price});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");    
    })

    it("try to buy 1, don't accept less, should fail", async function() {
        try {
            await product.buy("F2", false, Price, {from:user2, value:Price});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail");    
    })

    it("check overpay", async function() {
        assert.equal((await product.getPendingWithdrawal.call(user2)).toNumber(), Price * 2, "User2 should have overpay equal to price of 2 units");
    })
})



contract("Product. Change parameters, markAsDelivered, ratings", function(accounts) {    
    var vBalance1, vBalance2, pBalance1, pBalance2, nBalance1, nBalance2;
    var newWallet = accounts[8];

    it("create product and buy one", async function() {
        await Prepare(accounts, 1);         

        vBalance1 = await web3.eth.getBalance(vendorWallet);
        pBalance1 = await web3.eth.getBalance(provider);
        nBalance1 = await web3.eth.getBalance(newWallet);

        var txr = await pfactory.createProduct(vendor.address,"PPrice1", Price, 0, Denominator);
        product = Product.at(txr.logs[0].args.product);
        
        await product.buy("C1", true, Price, {from:user1, value: Price});
        assert.equal(await _SoldUnits(product), 1, "Should have sold 1 unit");
    })

    it("change active state", async function() {
        assert.isTrue(await _IsActive(product), "Product state should be active");
        await product.setParams("INACTIVE", await _Price(product), await _MaxUnits(product), false);
        assert.isFalse(await _IsActive(product), "Product state should be active");
    })

    it("try to buy, should fail", async function() {
        try {
            await product.buy("C4", true, Price, {from:user1, value: Price * 2});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Purchase should fail as product is inactive");
    })

    it("change active state back", async function() {        
        await product.setParams("ACTIVE", await _Price(product), await _MaxUnits(product), true);
        assert.isTrue(await _IsActive(product), "Product state should be active");
    })

    it("change state and params as not owner, should fail", async function() {        
        try {
            await product.setParams("INACTIVE", await _Price(product), await _MaxUnits(product), false, {from:user2});
        } catch(e) {
            return true;
        }

        assert.isTrue(false, "Change state should fail");
    })

    it("change price", async function() {
        await product.setParams("PPrice2", Price * 2, 0, true);
        assert.equal(await _Price(product), Price*2, "New price should be old*2");
    })

    it("buy 4 with old price in params, should fail ", async function() {
        try {
            await product.buy("C2", true, Price, {from:user2, value:Price*4});
        } catch(e) {
            return true;
        }
        
        assert.isTrue(false, "Purchase should fail");
    })

    it("buy one with new price", async function() {
        await product.buy("C3", true, Price*2, {from:user2, value: Price * 2});
        assert.equal(await _SoldUnits(product), 2, "Should have sold 2 units");

        var purchase = await getPurchase(product, 1);
        assert.equal(purchase.paidUnits.toNumber(), 1, "The latest purchase is 1 unit");
    }) 

    it("check vendor and provider balances, should equal Price(old) + Price*2(new)", async function() {
        vBalance2 = await web3.eth.getBalance(vendorWallet);
        pBalance2 = await web3.eth.getBalance(provider);
        
        assert.equal(vBalance2.minus(vBalance1).toNumber(), 270, "Vendor should get 270");
        assert.equal(pBalance2.minus(pBalance1).toNumber(), 30, "Provider should get 30");
    })

    it("try to change vendor wallet as not owner", async function() {
        try {
            var name = await vendor.name.call();
            await vendor.setParams(newWallet, name, {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "ChangeWallet should fail");
    })

    it("change vendor wallet", async function() {      
        var name = await vendor.name.call();
        await vendor.setParams(newWallet, name);
        assert.equal(await vendor.vendor.call(), newWallet, "Invalid new wallet");
    })

    it("buy and check wallet", async function() {
        await product.buy("C4", true, Price*2, {from:user1, value: Price * 2});
        assert.equal(await _SoldUnits(product), 3, "Should have sold 3 units");

        nBalance2 = await web3.eth.getBalance(newWallet);
        var pBalance3 = await web3.eth.getBalance(provider);
        //Profit for newWallet should be Price*2 - FEE, for provider Price*2*FEE
        assert.equal(nBalance2.minus(nBalance1).toNumber(), 180, "New walelt should get 180");
        assert.equal(pBalance3.minus(pBalance2).toNumber(), 20, "Provider should get 20");
    })

    it("mark as delivered", async function() {
        assert.equal(await product.getTotalPurchases.call(), 3, "Should be 3 Purchase objects");
                
        //events system
        //var purchase = await product.getPurchase.call(0);        
        // assert.isFalse(purchase[1], "Purchase [0] should be undelivered");
        
        // await product.markAsDelivered(0, true);
        // purchase = await product.getPurchase.call(0);
        // assert.isTrue(purchase[1], "Purchase [0] should be delivered");

        //storage system
        var purchase = await product.getPurchase.call(0);        
        assert.isFalse(getPurchaseDelivered(purchase), "Purchase [0] should be undelivered");
        
        await product.markAsDelivered(0, true);
        purchase = await product.getPurchase.call(0);
        assert.isTrue(getPurchaseDelivered(purchase), "Purchase [0] should be delivered");
    })

    it("mark as undelivered", async function() {        
        await product.markAsDelivered(0, false);
        var purchase = await product.getPurchase.call(0);
        assert.isFalse(getPurchaseDelivered(purchase), "Purchase [0] should be undelivered again");
    })

    it("mark as delivered as not an owner, should fail", async function() {
        try {
            await product.markAsDelivered(0, true, {from: user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "MarkAsDelivered should fail, wrong caller");
    })
    
    it("mark as delivered, index too great, should fail", async function() {
        try {
            await product.markAsDelivered(10, true);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "MarkAsDelivered should fail, wrong index");
    })

    it("check initial ratings. so far we have user1 - price, user2-price*2, user1-price*2", async function(){
        assert.equal(await product.getTotalPurchases.call(), 3, "There should be 3 purchases");
        var purchase1 = await product.getPurchase(0);
        var purchase2 = await product.getPurchase(1);
        var purchase3 = await product.getPurchase(2);

        assert.equal(getPurchasePrice(purchase1).toNumber(), Price, "Purchase1 price field should equal to 'Price'");
        assert.equal(getPurchasePrice(purchase2).toNumber(), Price*2, "Purchase2 price field should equal to 'Pricex2'");
        assert.equal(getPurchasePrice(purchase3).toNumber(), Price * 2, "Purchase3 price field should equal to 'Pricex2', it is unrated");

        assert.isFalse(getPurchaseBadRating(purchase1), "Purchase1 badRating field should be false");
        assert.isFalse(getPurchaseBadRating(purchase2), "Purchase2 badRating field should be false");
        assert.isFalse(getPurchaseBadRating(purchase3), "Purchase3 badRating field should be false");

        //storage system
        assert.equal(await product.getUserRatingIndex.call(user2), 2, "User2 first purchase index should equal 2");
        assert.equal(await product.getUserRatingIndex.call(user1), 1, "User1 first purchase index should equal 1");
        assert.equal(await product.getUserRatingIndex.call(owner), 0, "Non-customer first purchase index should equal 0");
    })

    it("user2 rates bad his purchase", async function() {
        await product.changeRating(false, {from:user2});

        var purchase1 = await product.getPurchase(0);
        var purchase2 = await product.getPurchase(1);
        var purchase3 = await product.getPurchase(2);

        assert.isFalse(getPurchaseBadRating(purchase1), "Purchase1 badRating field should be false");
        assert.isTrue(getPurchaseBadRating(purchase2), "Purchase2 badRating field should be true");
        assert.isFalse(getPurchaseBadRating(purchase3), "Purchase3 badRating field should be false");
    })
    
    it("user1 rates bad his purchase", async function() {
        await product.changeRating(false, {from:user1});

        var purchase1 = await product.getPurchase(0);
        var purchase2 = await product.getPurchase(1);
        var purchase3 = await product.getPurchase(2);

        assert.isTrue(getPurchaseBadRating(purchase1), "Purchase1 badRating field should be true");
        assert.isTrue(getPurchaseBadRating(purchase2), "Purchase2 badRating field should be true");
        assert.isFalse(getPurchaseBadRating(purchase3), "Purchase3 badRating field should be false");    
    })

    it("user1 rates good his purchase again", async function() {
        await product.changeRating(true, {from:user1});

        var purchase1 = await product.getPurchase(0);
        var purchase2 = await product.getPurchase(1);
        var purchase3 = await product.getPurchase(2);

        assert.isFalse(getPurchaseBadRating(purchase1), "Purchase1 badRating field should be false");
        assert.isTrue(getPurchaseBadRating(purchase2), "Purchase2 badRating field should be true");
        assert.isFalse(getPurchaseBadRating(purchase3), "Purchase3 badRating field should be false");   
    })
    
    it("unrate as not customer, should fail", async function() {
        try {
            await product.changeRating(true);
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "Unrating as not customer should fail");
    })    
})


contract("Product. Direct ether send to Product.", function(accounts) {
    it("create product", async function() {
        await Prepare(accounts, 1);
        await pfactory.createProduct(vendor.address, "P1", Price, 0, Denominator);
        product = Product.at(await vendor.products.call(0));        
    })

    it("try to send ether directly, fail", async function() {        
        try {
            await web3.eth.sendTransaction({from: user1, to:product.address, value: Price * 2});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Ether send should fail");
        //assert.equal(await product.getTotalPurchases.call(), 0, "Should be 0 purchases");
    })
})


contract("measure gas", async function(accounts) {
    var vendor1, vendor2, product1, product2;

    it("create vendor", async function() {
        Denominator = 1
        owner = accounts[0];
        vendorWallet = accounts[1];
        provider = accounts[2];
        user1 = accounts[3];
        user2 = accounts[4];
                
        allowedProducts = await CheckList.new();
        engine = await ProductEngine.new();
        console.log("Engine: " + web3.eth.getTransactionReceipt(engine.transactionHash).gasUsed);

        storage = await ProductDispatcherStorage.new(engine.address);
        console.log("Storage: " + web3.eth.getTransactionReceipt(storage.transactionHash).gasUsed);

        var ProductLibDispatcher = artifacts.require("LibDispatcher");
        ProductLibDispatcher.unlinked_binary = ProductLibDispatcher.unlinked_binary.replace(
            '1111222233334444555566667777888899990000',
            storage.address.slice(2));        
        dispatcher = await ProductLibDispatcher.new();
        console.log("Dispatcher: " + web3.eth.getTransactionReceipt(dispatcher.transactionHash).gasUsed);

        Product.link('IProductEngine', dispatcher.address);
        ProductFactory.link('IProductEngine', dispatcher.address);

        manager = await VendorManager.new(provider, Fee);
        console.log("Manager:  " + web3.eth.getTransactionReceipt(manager.transactionHash).gasUsed);

        factory = await VendorFactory.new(manager.address);        
        pfactory = await ProductFactory.new(manager.address, allowedProducts.address);        
        await manager.setFactory(factory.address, true);
        await manager.setFactory(pfactory.address, true);
        await allowedProducts.setManager(pfactory.address, true);
        console.log("Factory: " + web3.eth.getTransactionReceipt(factory.transactionHash).gasUsed);

        var bytesString = web3.fromUtf8("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЪЭЮЯ");
        //console.log(bytesString);
        var t1 = await factory.createVendor(vendorWallet, "bytesString");
        console.log("Vendor: " + t1.receipt.gasUsed);
        vendor1 = Vendor.at(t1.logs[0].args.vendor);
        
        await factory.createVendor(vendorWallet, "V11111111111111.2");        
        await factory.createVendor(user1, "V2.1", {from: user1});
        await factory.createVendor(user1, "V2sssssssssssss.1", {from: user1});
        await factory.createVendor(vendorWallet, "V1.2");        
        await factory.createVendor(vendorWallet, "Vasdasdsadasd.2");        
        await factory.createVendor(user1, "V2asdasdasd.1", {from: user1});
        await factory.createVendor(vendorWallet, "Vddddddddddddddddddddd");
        await factory.createVendor(user1, ".@0123456789abcdefghijklmnopqrstu", {from: user1});
        t1 = await factory.createVendor(user1, "123", {from: user1});
        console.log("Vendor (10-th): " + t1.receipt.gasUsed);
        vendor2 =  Vendor.at(t1.logs[0].args.vendor);        
    })

    it("create product", async function() {
        var t1 = await pfactory.createProduct(vendor1.address, "gas measure product", 1000, 0, Denominator);                
        console.log("Product: " + t1.receipt.gasUsed);
        product1 = Product.at(t1.logs[0].args.product);
        //console.log(await _Name(product1));

        await pfactory.createProduct(vendor1.address, "P2", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P3", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P4", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P5", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P6", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P7", 1000, 20, Denominator);        
        await pfactory.createProduct(vendor1.address, "P8", 1000, 20, Denominator);
        await pfactory.createProduct(vendor1.address, "P9", 1000, 20, Denominator);
        t1 = await pfactory.createProduct(vendor1.address, "P10", 1000, 20, Denominator);
        console.log("Product (10-th): " + t1.receipt.gasUsed);

        t1 = await pfactory.createProduct(vendor2.address, "P10", 1000, 20, Denominator, {from:user1});
        console.log("Product (1-st, Vendor2): " + t1.receipt.gasUsed);
    })

    it("buy", async function() {
        var t1 = await product1.buy("c1", false, 1000, {from:user2, value:1000});
        console.log("Buy: " + t1.receipt.gasUsed);
        var t1 = await product1.buy("c1", false, 1000, {from:user1, value:1000});
        console.log("Buy (purchase another user): " + t1.receipt.gasUsed);
        await product1.buy("c2", false, 1000, {from:user2, value:1000});
        await product1.buy("c3", false, 1000, {from:user2, value:1000});
        await product1.buy("c4", false, 1000, {from:user2, value:1000});
        await product1.buy("c5", false, 1000, {from:user2, value:1000});
        await product1.buy("c6", false, 1000, {from:user2, value:1000});
        await product1.buy("c7", false, 1000, {from:user2, value:1000});
        await product1.buy("c8", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});
        await product1.buy("c9", false, 1000, {from:user2, value:1000});        
        t1 = await product1.buy("x2", false, 1000, {from:user2, value:1000});
        console.log("Buy (20-th): " + t1.receipt.gasUsed);

        // for(var i = 0; i < 1000; ++i) {
        //     t1 = await product1.buy("x2safsdfsdf", false, 1000, {from:accounts[i%10], value:1000});
        //     console.log("Buy (20-th): " + t1.receipt.gasUsed);
        // }
    })
})

contract("Product denominator > 1", function(accounts) {
    let price1 = 10000;
    let price2 = 100;

    it("create unlimited product with denominator = 1000", async function() {
        await Prepare(accounts, 1000);
        
        let tx = await pfactory.createProduct(vendor.address, "D1000", price1, 0, Denominator);   
        product = Product.at(tx.logs[0].args.product);     
        assert.equal(await _Denominator(product), 1000, "Denominator should equal 1000");
    });

    it("pay for 1 product", async function() {
        await product.buy("Buy1", false, price1, {from:user1, value: price1});
        assert.equal(await product.getTotalPurchases.call(), 1, "1 purchase should be made");

        var purchase = await product.getPurchase.call(0);
        assert.equal(getPurchaseUnits(purchase), 1000, "1 unit should be bought during last purchase (1000 miliunits");

        assert.equal(await _SoldUnits(product), 1000, "1 unit should be sold totally (1000 miliunits");
    });

    it("pay for 1/2 product", async function() {
        await product.buy("Buy0.5", false, price1, {from:user1, value: price1/2});
        assert.equal(await product.getTotalPurchases.call(), 2, "2 purchases should be made");

        var purchase = await product.getPurchase.call(1);
        assert.equal(getPurchaseUnits(purchase), 500, "1/2 units should be bought during last purchase (500 miliunits");

        assert.equal(await _SoldUnits(product), 1500, "1.5 units should be sold totally (1500 miliunits");
    });

    it("buy smallest possible unit", async function() {
        await product.buy("Buy0.001", false, price1, {from:user1, value: price1/Denominator});
        assert.equal(await product.getTotalPurchases.call(), 3, "3 purchases should be made");

        var purchase = await product.getPurchase.call(2);
        assert.equal(getPurchaseUnits(purchase), 1, "0.001 units should be bought during last purchase (1 miliunit");

        assert.equal(await _SoldUnits(product), 1501, "1.501 units should be sold totally (1501 miliunits");
    });
    
    it("buy less than smallest unit, should fail", async function() {
        try {
            await product.buy("Buy-", false, price1, {from:user1, value: 2});
        } catch (e) {
            return true;
        }
        throw "should fail";
    });

    it("overpay", async function() {
        assert.equal(await product.getPendingWithdrawal.call(user2), 0, "Should be no pending withdrawals");

        let overpay = 3;
        await product.buy("BuyOverpay", false, price1, {from:user2, value: +overpay + 2*price1 });
        assert.equal(await product.getTotalPurchases.call(), 4, "4 purchases should be made");

        var purchase = await product.getPurchase.call(3);
        assert.equal(getPurchaseUnits(purchase), 2000, "2 units should be bought during last purchase (2000 miliunits");

        assert.equal(await _SoldUnits(product), 3501, "3.501 units should be sold totally (3501 miliunits");
        assert.equal(await product.getPendingWithdrawal.call(user2), 3, "Pending withdrawals should equal 3");
    });
})
