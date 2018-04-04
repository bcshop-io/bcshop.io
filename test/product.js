let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let time = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

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
    let active = true;
    let useEscrow = false;
    let useFiatPrice = false;
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";
    
    before(async function() {
        storage = await Storage.new();        

        await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);        
    });

    it("verifies basic data", async function() {
        var result = await storage.getProductData.call(0);
        assert.equal(result[0], price, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");
        
        assert.equal(await storage.getTotalProducts.call(), 1, "Invalid total products");        
        assert.equal(await storage.getTotalPurchases.call(0), 0, "Invalid total purchases"); 
        assert.isFalse(await storage.isEscrowUsed.call(0), "Invalid escrow flag");
        assert.equal(await storage.isFiatPriceUsed.call(0), useFiatPrice, "Invalid fiat price");
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

    it("verifies text data", async function() {
        var result = await storage.getTextData.call(0);
        assert.equal(result[0], name, "Invalid name");
        assert.equal(result[1], data, "Invalid data");
    });

    it("verifies data after editProduct", async function() {
        await storage.editProduct(0, 555, 32, false, 1, 2, true, true, "NEWNAME", "NEWDATA");
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], 555, "Invalid price");
        assert.equal(result[1], 32, "Invalid maxUnits");

        assert.isTrue(await storage.isEscrowUsed.call(0), "Invalid escrow flag");
        assert.equal(await storage.isFiatPriceUsed.call(0), true, "Invalid fiat price");
        
        assert.equal(owner, await storage.getProductOwner.call(0), "Invalid owner");        
            
        result = await storage.getProductActivityData.call(0);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], 1, "Invalid start time");
        assert.equal(result[2], 2, "Invalid end time");        
                        
        result = await storage.getTextData.call(0);
        assert.equal(result[0], "NEWNAME", "Invalid name");
        assert.equal(result[1], "NEWDATA", "Invalid data");
    });

    it("verifies vendorInfo default data", async function() {
        var data = await storage.vendors.call(owner);
        assert.equal(data[0], 0, "Vendor wallet should equal 0x0 in storage by default");
        assert.equal(await storage.getVendorWallet.call(owner), owner, "Invalid getVendorWallet result, should equal to address");
        assert.equal(await storage.getVendorFee.call(owner), 0, "Invalid vendor fee");        
    });

     it("verifies data after setVendorInfo", async function() {
        await storage.setVendorInfo(owner, wallet, 100);

        assert.equal(await storage.getVendorWallet.call(owner), wallet, "Invalid vendor wallet");
        assert.equal(await storage.getVendorFee.call(owner), 100, "Invalid vendor fee");        
    });

    it("verifies data after addPurchase", async function() {
        var oldResult = await storage.getProductData.call(0);

        await storage.addPurchase(0, accounts[5], 999, 12, "MYID");
        assert.equal(await storage.getTotalPurchases.call(0), 1, "Invalid total purchases"); 
        var result = await storage.getProductData.call(0);

        assert.equal(result[2].toNumber(), oldResult[2]+12, "Invalid soldUnits");
        assert.equal(await storage.getPurchase.call(0, 0), 0, "Invalid purchase state");
        // let result = await storage.getPurchase.call(0, 0);
        // assert.equal(result[0], accounts[5], "Invalid buyer");
        // assert.equal(result[1], "MYID", "Invalid id");
        // assert.equal(result[2], 999, "Invalid price");
        // assert.equal(result[3], 12, "Invalid amount");        
    });

    it("verifies data after changePurchase", async function() {
        await storage.changePurchase(0,0,3);
        assert.equal(await storage.getPurchase.call(0, 0), 3, "Invalid purchase state");
    });

    it("verifies data after banProduct", async function() {
        assert.isFalse(await storage.banned.call(0), "Initially should be not banned");
        await storage.banProduct(0, true);
        assert.isTrue(await storage.banned.call(0), "Now should be not banned");
    });

    it("verifies data after setEscrowData", async function() {
        await storage.setEscrowData(0, 0, user, 100, 300, 9999);
        let result = await storage.getEscrowData(0,0);
        assert.equal(result[0], user, "Invalid customer");
        assert.equal(result[1], 100, "Invalid fee");
        assert.equal(result[2], 300, "Invalid profit");
        assert.equal(result[3], 9999, "Invalid timestamp");
    });

    it("verifies data after changeOwner", async function() {        
        let currentOwner = await storage.getProductOwner.call(0);
        assert.notEqual(currentOwner, user, "invalid current owner");
        await storage.changeOwner(0, user);
        assert.equal(user, await storage.getProductOwner.call(0), "Invalid owner");
        await storage.changeOwner(0, currentOwner);
    });

    it("verifies data after changeSoldUnits", async function() {                
        await storage.changeSoldUnits(0, 999);
        var result = await storage.getProductData.call(0);
        assert.equal(999, result[2], "Invalid sold units");
    });

    it("can't call changeSoldUnits as not manager", async function() {
        await utils.expectContractException(async function() {
            await storage.changeSoldUnits(0, 1000, {from:user});
        });
    });

    it("can't call changeOwner as not manager", async function() {
        await utils.expectContractException(async function() {
            await storage.changeOwner(0, user, {from:user});
        });
    });

    it("can't call setVendorInfo as not manager", async function() {
        try {
            await storage.setVendorInfo(owner, wallet, 100, {from:user});
        } catch(e) {
            return true;
        }
        throw "FAIL";        
    });
    
    it("can't call createProduct as not manager", async function() {
        try {
            await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    }); 

    it("can't call editProduct as not manager", async function() {
        try {
            await storage.editProduct(0, 555, 32, false, 1, 2, false, true, "NEWNAME", "NEWDATA", {from:user});
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

    it("can't call setEscrowData as not manager", async function() {
        try {
            await storage.setEscrowData(0, 0, user, 100, 300, 9999, {from:user});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call changePurchase as not manager", async function() {
        try {
            await storage.changePurchase(0,0,3, {from:user});
        } catch(e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call changeSoldUnits with invalid product id", async function() {
        await utils.expectContractException(async function() {
            await storage.changeSoldUnits(1, 1000);
        });
    });

    it("can't call changeOwner with invalid product id", async function() {
        await utils.expectContractException(async function() {
            await storage.changeOwner(1, user);
        });
    });

    it("can't call editProduct with invalid product id", async function() {
        try {
            await storage.editProduct(1, 555, 32, false, 1, 2, false, false, "NEWNAME", "NEWDATA", {from:owner});
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
    
    it("can't call setEscrowData with invalid product id", async function() {
        try {
            await storage.setEscrowData(1, 0, user, 100, 300, 9999, {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call setEscrowData with invalid purchase id", async function() {
        try {
            await storage.setEscrowData(0, 1, user, 100, 300, 9999, {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call setEscrowData if product doesn't use escrow", async function() {
        await storage.editProduct(0, 555, 32, false, 1, 2, false, false, "NEWNAME", "NEWDATA");
        try {
            await storage.setEscrowData(0, 0, user, 100, 300, 9999, {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call changePurchase with invalid product id", async function() {
        try {
            await storage.changePurchase(1,0,3, {from:owner});
        } catch(e) {
            return true;
        }
        throw "FAIL";
    });

    it("can't call changePurchase with invalid purchase id", async function() {
        try {
            await storage.changePurchase(0,1,3, {from:owner});
        } catch(e) {
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
    let active = false;
    let useEscrow = false;
    let useFiatPrice = false;
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";
    
    before(async function() {
        storage = await Storage.new();
        factory = await Factory.new(storage.address);
        await storage.setManager(factory.address, true);
    });

    it("verifies data after createSimpleProduct", async function() {
        await factory.createSimpleProduct(price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data, {from:user});
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], price, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");    
        
        assert.equal(user, await storage.getProductOwner.call(0), "Invalid owner");        
        assert.equal(useEscrow, await storage.isEscrowUsed.call(0), "Invalid escrow usage");
        assert.equal(useFiatPrice, await storage.isFiatPriceUsed.call(0), "Invalid fiat price usage");
            
        result = await storage.getProductActivityData.call(0);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], startTime, "Invalid start time");
        assert.equal(result[2], endTime, "Invalid end time");        

        result = await storage.getTextData.call(0);
        assert.equal(result[0], name, "Invalid name");
        assert.equal(result[1], data, "Invalid data");        
    });

    it("verifies data after createSimpleProductAndVendor", async function() {        
        await factory.createSimpleProductAndVendor(wallet, price * 2, maxUnits, active, 10, 20, useEscrow,useFiatPrice, "NAME2", "DATA2", {from:user});
                
        let result = await storage.getProductData.call(1);
        assert.equal(result[0], price*2, "Invalid price");
        assert.equal(result[1], maxUnits, "Invalid maxUnits");
        assert.equal(result[2], 0, "Invalid soldUnits");    
        
        assert.equal(user, await storage.getProductOwner.call(1), "Invalid owner");        
        assert.equal(useEscrow, await storage.isEscrowUsed.call(1), "Invalid escrow data");
        assert.equal(useFiatPrice, await storage.isFiatPriceUsed.call(0), "Invalid fiat price usage");
            
        result = await storage.getProductActivityData.call(1);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], 10, "Invalid start time");
        assert.equal(result[2], 20, "Invalid end time");        
                            
        assert.equal(await storage.getVendorWallet.call(user), wallet, "Invalid wallet");
        assert.equal(await storage.getVendorFee.call(user), 0, "Invalid fee policy");
            
        result = await storage.getTextData.call(1);
        assert.equal(result[0], "NAME2", "Invalid Name");
        assert.equal(result[1], "DATA2", "Invalid data");
    });

    it("verifies data after editSimpleProduct", async function() {
        await factory.editSimpleProduct(0, 555, 32, true, 0, 0, false,false, "NEWNAME", "NEWDATA", {from:user});
        let tx = await factory.editSimpleProduct(0, 555, 32, false, 1, 2,true, true, "NEWNAME", "NEWDATA", {from:user});        
                
        let result = await storage.getProductData.call(0);
        assert.equal(result[0], 555, "Invalid price");
        assert.equal(result[1], 32, "Invalid maxUnits");
        
        assert.equal(user, await storage.getProductOwner.call(0), "Invalid owner");        
        assert.equal(true, await storage.isEscrowUsed.call(0), "Invalid escrow data");
        assert.equal(true, await storage.isFiatPriceUsed.call(0), "Invalid fiat price usage");
            
        result = await storage.getProductActivityData.call(0);
        assert.isFalse(result[0], "Invalid active");
        assert.equal(result[1], 1, "Invalid start time");
        assert.equal(result[2], 2, "Invalid end time");        
                    
        result = await storage.getTextData.call(0);
        assert.equal(result[0], "NEWNAME", "Invalid name");
        assert.equal(result[1], "NEWDATA", "Invalid data");
    });

    it("verifies data after setVendorWallet", async function() {
        await factory.setVendorWallet(accounts[5], {from:user});
                
        assert.equal(await storage.getVendorWallet.call(user), accounts[5], "Invalid wallet");
        assert.equal(await storage.getVendorFee.call(user), 0, "Invalid fee");
    });

    it("can't createSimpleProduct if endTime <= startTime", async function() {        
        await factory.setActive(true);
        await utils.expectContractException(async function() {
            await factory.createSimpleProduct(price, maxUnits, active, 100, 90, useEscrow, useFiatPrice, name, data, {from:user});
        });
    });
    
    it("can't editSimpleProduct if endTime <= startTime", async function() {        
        await factory.setActive(true);
        await utils.expectContractException(async function() {
            await factory.editSimpleProduct(0, 555, 32, false, 3, 1,true, true, "NEWNAME", "NEWDATA", {from:user});
        });
    });

    it("can't call createSimpleProduct if contract is inactive", async function() {
        await factory.setActive(false);
        await utils.expectContractException(async function() {
            await factory.createSimpleProduct(price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data, {from:user});
        });
    });

    it("can't call createSimpleProductAndVendor if contract is inactive", async function() {
        await factory.setActive(false);
        await utils.expectContractException(async function() {
            await factory.createSimpleProductAndVendor(wallet, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data, {from:user});
        });
    });

    it("can't call editSimpleProduct if contract is inactive", async function() {
        await factory.setActive(false);
        await utils.expectContractException(async function() {
            await factory.editSimpleProduct(0, 555, 32, false, 1, 2, true, true, "NEWNAME", "NEWDATA", {from:user});
        });
    });

    it("can't call setVendorWallet if contract is inactive", async function() {
        await factory.setActive(false);
        await utils.expectContractException(async function() {
            await factory.setVendorWallet(accounts[5], {from:user});
        });
    });

    it("can't call editSimpleProduct as not product's owner", async function() {
        try {
            await factory.editSimpleProduct(0, 555, 32, false, 1, 2, true, true, "NEWNAME", "NEWDATA", {from:owner});
        } catch (e) {
            return true;
        }
        throw "FAIL";
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
    let active = true;
    let useEscrow = true;
    let useFiatPrice = true;
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";

    beforeEach(async function() {
        storage = await Storage.new();
        factory = await Factory.new(storage.address);
        await storage.setManager(factory.address, true);
    });

    it("create storage", async function() {        
        console.log("Gas used: " + web3.eth.getTransactionReceipt(storage.transactionHash).gasUsed);
    });

    it("create factory ", async function() {        
        console.log("Gas used: " + web3.eth.getTransactionReceipt(factory.transactionHash).gasUsed);
    });

    it("storage.createProduct", async function() {        
        let tx = await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data); 
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data); 
        console.log("Gas used 2: " + tx.receipt.gasUsed);

        //235781 - with no 'string data'
        //235781/223028 - with 'string data' in the struct, without any interaction with it                
        //256376 - assign 15 symbols literal string
        
        //221k/206k - assign empty string
        //238k/223k - assign "Address 1|Address 2|Phone" through parameter
        //237k/222k - assign "1|2|3" through parameter
    });

    it("factory.createSimpleProduct", async function() {
        let tx = await factory.createSimpleProduct(price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await factory.createSimpleProduct(price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);
        console.log("Gas used 2: " + tx.receipt.gasUsed);
        
        //223k/208k - assign empty string
        //240k/225k - assign "Address 1|Address 2|Phone" through parameter        
        //239k/224k - assign "1|2|3" through parameter
    });

    it("factory.editSimpleProduct", async function() {
        let tx = await factory.createSimpleProduct(price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);
        tx = await factory.editSimpleProduct(0, price/2, maxUnits+1, false, startTime + 10, endTime + 20, false, false, "XXXXX", "CCCC");        
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        tx = await factory.editSimpleProduct(0, price, maxUnits, true, startTime + 20, endTime + 30, true, true, "AAAAA", "BBBB");        
        console.log("Gas used 2: " + tx.receipt.gasUsed);

        //66k/127k
    })

    it("factory.createSimpleProductAndVendor x40", async function() {
        let tx = await factory.createSimpleProductAndVendor(wallet, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);
        console.log("Gas used 1: " + tx.receipt.gasUsed);

        for(let i = 0; i < 40; ++i) {
            tx = await factory.createSimpleProductAndVendor(wallet, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data, {from:accounts[i%10]});            
        }
        console.log("Gas used last: " + tx.receipt.gasUsed);

        let ownerr = await storage.getProductOwner.call(20);        
        
        //250840/235840 - assign empty string
        //268002/238002 assign "Address 1|Address 2|Phone" through parameter
    });

    it("storage.createProduct x40", async function() {
        let tx = await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data); 
        console.log("Gas used first: " + tx.receipt.gasUsed);

        for(let i = 0; i < 40; ++i) {
            tx = await storage.createProduct(owner, price, maxUnits, active, startTime, endTime, useEscrow, useFiatPrice, name, data);             
        }
        console.log("Gas used last: " + tx.receipt.gasUsed);

        //235781 - with no 'string data'
        //235781/223028 - with 'string data' in the struct, without any interaction with it        
        //241358/228605 - assign empty string
        //256376 - assign 15 symbols literal string
        //236737/221737 - assign "Address 1|Address 2|Phone" through parameter
    });
});
