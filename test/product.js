let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./timeutils.js"))(web3);

let Storage = artifacts.require("ProductStorage");
let Factory = artifacts.require("ProductMaker");

contract("ProductStorage. ", function(accounts) {

    let storage;
    let owner = accounts[0];
    let wallet = accounts[1];
    let user = accounts[2];
    let price = 10000;    
    let maxUnits = 10;
    let startTime = 1517356800;
    let endTime = 1517356900;
    let feePolicy = accounts[3];
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";
    
    before(async function() {
        storage = await Storage.new();        

        await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
    });

    it("verifies basic data", async function() {
        var result = await storage.getProductData.call(0);
        assert.equal(result[0], price, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");
        
        assert.equal(await storage.getTotalProducts.call(), 1, "Invalid total products");        
        assert.equal(await storage.getTotalPurchases.call(0), 0, "Invalid total purchases"); 
    });

    it("verifies owner", async function() {
        assert.equal(owner, await storage.getProductOwner.call(0), "Invalid owner");
    });

    it("verifies activity data", async function() {
        var result = await storage.getProductActivityData.call(0);
        assert.isTrue(result[0], "Invalid active");
        assert.equal(result[1], startTime, "Invalid start time");
        assert.equal(result[2], endTime, "Invalid end time");
    });

    it("verifies payment data", async function() {
        var result = await storage.getProductPaymentData.call(0);
        assert.equal(result[0], wallet, "Invalid wallet");
        assert.equal(result[1], feePolicy, "Invalid fee policy");
    });

    it("verifies text data", async function() {
        var result = await storage.getTextData.call(0);
        assert.equal(result[0], name, "Invalid name");
        assert.equal(result[1], data, "Invalid data");
    });

    it("verifies data after editProduct", async function() {
        await storage.editProduct(0, accounts[7], 555, 32, false, 14, 1, 2, "NEWNAME", "NEWDATA");
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], 555, "Invalid price");
        assert.equal(result[1], 32, "Invalid maxUnits");
        assert.equal(result[2], 14, "Invalid soldUnits");    
        
        assert.equal(owner, await storage.getProductOwner.call(0), "Invalid owner");        
            
        result = await storage.getProductActivityData.call(0);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], 1, "Invalid start time");
        assert.equal(result[2], 2, "Invalid end time");        
            
        result = await storage.getProductPaymentData.call(0);
        assert.equal(result[0], accounts[7], "Invalid wallet");
        assert.equal(result[1], feePolicy, "Invalid fee policy");
            
        result = await storage.getTextData.call(0);
        assert.equal(result[0], "NEWNAME", "Invalid name");
        assert.equal(result[1], "NEWDATA", "Invalid data");
    });

    it("verifies data after setCustomParams", async function() {
        await storage.setCustomParams(0, 0);
        let result = await storage.getProductPaymentData.call(0);
        assert.equal(result[1], 0, "Invalid fee policy");
    });

    it("verifies data after addPurchase", async function() {
        await storage.addPurchase(0, accounts[5], 999, 12, "MYID");
        assert.equal(await storage.getTotalPurchases.call(0), 1, "Invalid total purchases"); 
        var result = await storage.getProductData.call(0);

        assert.equal(result[2], 14+12, "Invalid soldUnits");
        // let result = await storage.getPurchase.call(0, 0);
        // assert.equal(result[0], accounts[5], "Invalid buyer");
        // assert.equal(result[1], "MYID", "Invalid id");
        // assert.equal(result[2], 999, "Invalid price");
        // assert.equal(result[3], 12, "Invalid amount");        
    });

    it("verifies data after banProduct", async function() {
        assert.isFalse(await storage.banned.call(0), "Initially should be not banned");
        await storage.banProduct(0, true);
        assert.isTrue(await storage.banned.call(0), "Now should be not banned");
    });

    it("can't call setCustomParams as not manager", async function() {
        try {
            await storage.setCustomParams(0, feePolicy, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 
    
    it("can't call createProduct as not manager", async function() {
        try {
            await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call editProduct as not manager", async function() {
        try {
            await storage.editProduct(0, accounts[7], 555, 32, false, 14, 1, 2, "NEWNAME", "NEWDATA", {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call addPurchase as not manager", async function() {
        try {
            await storage.addPurchase(0, user, 400, 1, "ID", {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call banProduct as not manager", async function() {
        try {
            await storage.banProduct(0, true, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call setCustomParams with invalid product id", async function() {
        try {
            await storage.setCustomParams(1, feePolicy, {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call editProduct with invalid product id", async function() {
        try {
            await storage.editProduct(1, accounts[7], 555, 32, false, 14, 1, 2, "NEWNAME", "NEWDATA", {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call addPurchase with invalid product id", async function() {
        try {
            await storage.addPurchase(1, user, 400, 1, "ID", {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call banProduct with invalid product id", async function() {
        try {
            await storage.banProduct(1, true, {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 
});


contract("ProductMaker. ", function(accounts) {

    let storage;
    let owner = accounts[0];
    let wallet = accounts[1];
    let user = accounts[2];
    let price = 10000;    
    let maxUnits = 10;
    let startTime = 1517356800;
    let endTime = 1517356900;
    let feePolicy = accounts[3];
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";

    before(async function() {
        storage = await Storage.new();
        factory = await Factory.new(storage.address);
        await storage.setManager(factory.address, true);
    });

    it("verifies data after createSimpleProduct", async function() {
        await factory.createSimpleProduct(wallet, price, maxUnits, startTime, endTime, name, data, {from:user});
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], price, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");    
        
        assert.equal(user, await storage.getProductOwner.call(0), "Invalid owner");        
            
        result = await storage.getProductActivityData.call(0);
        assert.isTrue(result[0], "Invalid active");
        assert.equal(result[1], startTime, "Invalid start time");
        assert.equal(result[2], endTime, "Invalid end time");        
            
        result = await storage.getProductPaymentData.call(0);
        assert.equal(result[0], wallet, "Invalid wallet");
        assert.equal(result[1], 0, "Invalid fee policy");
            
        result = await storage.getTextData.call(0);
        assert.equal(result[0], name, "Invalid name");
        assert.equal(result[1], data, "Invalid data");        
    });

    it("verifies data after editSimpleProduct", async function() {
        await factory.editSimpleProduct(0, accounts[7], 555, 32, false, 14, 1, 2, "NEWNAME", "NEWDATA", {from:user});
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], 555, "Invalid price");
        assert.equal(result[1], 32, "Invalid maxUnits");
        assert.equal(result[2], 14, "Invalid soldUnits");    
        
        assert.equal(user, await storage.getProductOwner.call(0), "Invalid owner");        
            
        result = await storage.getProductActivityData.call(0);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], 1, "Invalid start time");
        assert.equal(result[2], 2, "Invalid end time");        
            
        result = await storage.getProductPaymentData.call(0);
        assert.equal(result[0], accounts[7], "Invalid wallet");
        assert.equal(result[1], 0, "Invalid fee policy");
            
        result = await storage.getTextData.call(0);
        assert.equal(result[0], "NEWNAME", "Invalid name");
        assert.equal(result[1], "NEWDATA", "Invalid data");
    });

    it("can't call editSimpleProduct as not product's owner", async function() {
        try {
            await factory.editSimpleProduct(0, accounts[7], 555, 32, false, 14, 1, 2, "NEWNAME", "NEWDATA");           
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("verifies data after createSpecialProduct", async function() {  
        await factory.createSpecialProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, "PRODUCT2", "DATA");
                
        let result = await storage.getProductData.call(1);
        assert.equal(result[0], price, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");    
        
        assert.equal(owner, await storage.getProductOwner.call(1), "Invalid owner");        
            
        result = await storage.getProductActivityData.call(1);
        assert.isTrue(result[0], "Invalid active");
        assert.equal(result[1], startTime, "Invalid start time");
        assert.equal(result[2], endTime, "Invalid end time");        
            
        result = await storage.getProductPaymentData.call(1);
        assert.equal(result[0], wallet, "Invalid wallet");
        assert.equal(result[1], feePolicy, "Invalid fee policy");
            
        result = await storage.getTextData.call(1);
        assert.equal(result[0], "PRODUCT2", "Invalid name");
        assert.equal(result[1], "DATA", "Invalid data");

        assert.equal(await storage.getTotalProducts.call(), 2, "Invalid total products");
    });

    it("can't call createSpecialProduct as not owner", async function() {
        try {
            await factory.createSpecialProduct(owner, wallet, price, maxUnits, startTime, endTime, 
                                            feePolicy, "PRODUCT2", "DATA", {from:accounts[1]});         
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call setCustomParams as not owner", async function() {
        try {
            await factory.setCustomParams(0, feePolicy, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("verifies data after setCustomParams", async function() {
        await factory.setCustomParams(0, feePolicy);
        let result = await storage.getProductPaymentData.call(0);        
        assert.equal(result[1], feePolicy, "Invalid fee policy");
    });
});


contract("Measure gas usage", function(accounts) {
    let storage;
    let factory;
    let owner = accounts[0];
    let wallet = accounts[1];
    let user = accounts[2];
    let price = 10000;    
    let maxUnits = 10;
    let startTime = 1517356800;
    let endTime = 1517356900;
    let feePolicy = accounts[3];
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";

    it("create storage", async function() {
        storage = await Storage.new();
        console.log("Gas used: " + web3.eth.getTransactionReceipt(storage.transactionHash).gasUsed);
    });

    it("create factory ", async function() {
        factory = await Factory.new(storage.address);
        console.log("Gas used: " + web3.eth.getTransactionReceipt(factory.transactionHash).gasUsed);
    });

    it("storage.createProduct", async function() {
        storage = await Storage.new();        
        let tx = await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
        console.log("Gas used 2: " + tx.receipt.gasUsed);

        //235781 - with no 'string data'
        //235781/223028 - with 'string data' in the struct, without any interaction with it        
        //241358/228605 - assign empty string
        //256376 - assign 15 symbols literal string
        //258569/243569 - assign "Address 1|Address 2|Phone" through parameter
    });

    it("factory.createSimpleProduct", async function() {
        storage = await Storage.new();
        factory = await Factory.new(storage.address);
        await storage.setManager(factory.address, true);

        let tx = await factory.createSimpleProduct(wallet, price, maxUnits, startTime, endTime, name, data);
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await factory.createSimpleProduct(wallet, price, maxUnits, startTime, endTime, name, data);
        console.log("Gas used 2: " + tx.receipt.gasUsed);

        //232509/217509 - assign empty string
        //249919/234919 assign "Address 1|Address 2|Phone" through parameter        
    });

    it("factory.createSpecialProduct", async function() {
        storage = await Storage.new();
        factory = await Factory.new(storage.address);
        await storage.setManager(factory.address, true);

        let tx = await factory.createSpecialProduct(owner, wallet, price, maxUnits, startTime, endTime,feePolicy, name, data);
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await factory.createSpecialProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
        console.log("Gas used 2: " + tx.receipt.gasUsed);

        //250840/235840 - assign empty string
        //268272/253272 assign "Address 1|Address 2|Phone" through parameter
    });

    it("storage.createProduct x40", async function() {
        storage = await Storage.new();        
        let tx = await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
        console.log("Gas used first: " + tx.receipt.gasUsed);

        for(let i = 0; i < 40; ++i) {
            tx = await storage.createProduct(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);            
        }
        console.log("Gas used last: " + tx.receipt.gasUsed);

        //235781 - with no 'string data'
        //235781/223028 - with 'string data' in the struct, without any interaction with it        
        //241358/228605 - assign empty string
        //256376 - assign 15 symbols literal string
        //258569/243569 - assign "Address 1|Address 2|Phone" through parameter
    });
});
