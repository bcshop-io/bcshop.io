let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let timeutils = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

let owner;
let manager;
let user;
let token;
let storage;
let feePolicy;
let feeWallet;

const DefaultFeePermille = 100;
const EscrowFeePermille = 50;
const FiatPriceFeePermille = 70;
const MinEscrowFee = utils.toWei(0.02);
const MinTokensForDiscount = utils.toWei(1);
const TermDuration = 2592000;
const MaxDiscountPerToken = utils.toWei(0.1);
const FeeDiscountPermille = 600;

async function prepare(options={}) {
    token = await utils.createToken();
    storage = await utils.createProductStorage();
    await createProduct(options);
    await createFeePolicy(options);    
}

async function createFeePolicy(options = {}) {
    feePolicy = await utils.createFeePolicy(
        options.storage==undefined ? storage : options.storage, 
        options.defaultFee==undefined ? DefaultFeePermille : options.defaultFee,
        utils.or(options.escrowFee, EscrowFeePermille),
        utils.or(options.fiatPriceFee, FiatPriceFeePermille),
        options.feeWallet==undefined ? feeWallet : options.feeWallet, 
        options.token==undefined ? token : options.token,
        options.minTokens==undefined ? MinTokensForDiscount : options.minTokens,
        options.term==undefined ? TermDuration : options.term,
        utils.or(options.maxDiscountPerToken, MaxDiscountPerToken),
        options.feeDiscount==undefined ? FeeDiscountPermille : options.feeDiscount
    );    
}

async function createProduct(options = {}) {
    await storage.createProduct(
        owner,
        utils.or(options.price, 1000000),
        utils.or(options.maxUnits, 0),
        utils.or(options.isActive, true),
        utils.or(options.startTime, 0), 
        utils.or(options.endTime, 0), 
        utils.or(options.useEscrow, false), 
        utils.or(options.useFiatPrice, false),
        utils.or(options.name, "Name"),
        utils.or(options.data, "Email"), 
    );
}

contract("FeePolicy. Creation", function(accounts){
    owner = accounts[0];
    manager = accounts[1];
    user = accounts[2];
    feeWallet = accounts[3];

    before(async function() {
        token = await utils.createToken();
        storage = await utils.createProductStorage();
    });
    
    function exceptionOnCreation(comment, options) {
        it(comment, async function() {
            await utils.expectContractException(async function() {
                await createFeePolicy(options);
            });
        });
    }
    
    it("verifies data after valid creation", async function() {
        
        await createFeePolicy(); 

        assert.equal(await feePolicy.productStorage.call(), storage.address, "Invalid storage");
        assert.equal(await feePolicy.defaultFee.call(), DefaultFeePermille, "Invalid default fee");
        assert.equal(await feePolicy.escrowFee.call(), EscrowFeePermille, "Invalid escrow fee");
        assert.equal(await feePolicy.fiatPriceFee.call(), FiatPriceFeePermille, "Invalid fiat price fee");
        assert.equal(await feePolicy.feeWallet.call(), feeWallet, "Invalid fee wallet");
        assert.equal(await feePolicy.token.call(), token.address, "Invalid token");
        assert.equal(await feePolicy.minTokenForDiscount.call(), MinTokensForDiscount, "Invalid min tokens");
        assert.equal(await feePolicy.termDuration.call(), TermDuration, "Invalid term duration");
        assert.equal(await feePolicy.maxDiscountPerToken.call(), MaxDiscountPerToken, "Invalid max discount per token");
        assert.equal(await feePolicy.discount.call(), FeeDiscountPermille, "Invalid fee discount");
    });

    exceptionOnCreation("can't create feePolicy with default fee > 1000 pm", {defaultFee:1001});
    exceptionOnCreation("can't create feePolicy with escrow fee > 1000 pm", {escrowFee:1001});
    exceptionOnCreation("can't create feePolicy with fiat price fee > 1000 pm", {fiatPriceFee:1001});
    exceptionOnCreation("can't create feePolicy with fee discount > 1000 pm", {feeDiscount:1001}); 
    exceptionOnCreation("can't create feePolicy with term duration = 0", {term:0}); 
    exceptionOnCreation("can't create feePolicy with fee sum > 1000", {defaultFee:400, escrowFee:350, fiatPriceFee:400});
});


async function setFeePolicyParams(options = {}) {
    await feePolicy.setParams(
        utils.or(options.defaultFee, DefaultFeePermille),
        utils.or(options.escrowFee, EscrowFeePermille), 
        utils.or(options.fiatPriceFee, FiatPriceFeePermille),
        utils.or(options.feeWallet, feeWallet), 
        utils.or(options.token, token.address),
        utils.or(options.minTokens, MinTokensForDiscount),
        utils.or(options.maxDiscountPerToken, MaxDiscountPerToken),
        utils.or(options.feeDiscount, FeeDiscountPermille),
        {from: utils.or(options.from, owner)}
    );    
}


contract("FeePolicy. Access and restrictions", function(accounts) {

    owner = accounts[0];
    manager = accounts[1];
    user = accounts[2];
    feeWallet = accounts[3];

    beforeEach(async function() {
        await prepare();
    });

    function exceptionOnSetParams(comment, options) {
        it(comment, async function() {
            await utils.expectContractException(async function() {
                await setFeePolicyParams(options);
            });
        });
    }

    it("setParams can be called by owner, verifies the result", async function() {
        let newToken = await utils.createToken();
        await setFeePolicyParams({
            defaultFee:115,
            escrowFee:256,
            fiatPriceFee:98,
            feeWallet:accounts[4],             
            token: newToken.address,
            minTokens:987,
            maxDiscountPerToken:1098832,
            feeDiscount:200,
            from:owner}
        );
        
        assert.equal(await feePolicy.productStorage.call(), storage.address, "Invalid storage");
        assert.equal(await feePolicy.defaultFee.call(), 115, "Invalid default fee");
        assert.equal(await feePolicy.escrowFee.call(), 256, "Invalid escrow fee"); 
        assert.equal(await feePolicy.fiatPriceFee.call(), 98, "Invalid fiat price fee");
        assert.equal(await feePolicy.feeWallet.call(), accounts[4], "Invalid fee wallet");
        assert.equal(await feePolicy.token.call(), newToken.address, "Invalid token");
        assert.equal(await feePolicy.minTokenForDiscount.call(), 987, "Invalid min tokens");
        assert.equal(await feePolicy.maxDiscountPerToken.call(), 1098832, "Invalid max total discount");
        assert.equal(await feePolicy.discount.call(), 200, "Invalid fee discount");
    });

    exceptionOnSetParams("can't setParams with default fee > 1000 pm", {defaultFee:1001});    
    exceptionOnSetParams("can't setParams with escrow fee > 1000 pm", {escrowFee:1001});
    exceptionOnSetParams("can't setParams with fiat price fee > 1000 pm", {fiatPriceFee:1001});
    exceptionOnSetParams("can't setParams with fee discount > 1000 pm", {feeDiscount:1001}); 
    exceptionOnSetParams("can't setParams if not owner", {from:manager}); 
    exceptionOnSetParams("can't setParams with fee sum > 1000", {defaultFee:400, escrowFee:350, fiatPriceFee:400});
});

contract("FeePolicy. Max discount per term", function(accounts) {
    owner = accounts[0];
    manager = accounts[1];
    feeWallet = accounts[3];

    before(async function() {
        await prepare();
        await token.transfer(accounts[2], utils.toWei(2), {from:owner});
        await token.transfer(accounts[3], utils.toWei(0.5), {from:owner});
        await token.transfer(accounts[4], utils.toWei(4.2), {from:owner});    
    });

    async function checkMaxTotalDiscount(user, expectedMaxDiscount) {
        assert.equal(await feePolicy.getMaxTotalDiscount.call(user), expectedMaxDiscount, "Invalid max discount");
        assert.equal(await feePolicy.getRemainingDiscount.call(user), expectedMaxDiscount, "Invalid remaining discount");
    }

    it("user has 2 tokens, expected 2*0.1", async function() {
        await checkMaxTotalDiscount(accounts[2], 2 * MaxDiscountPerToken);
    });

    it("user has 0.5 tokens, expected 0.5*0.1, though it's less than min required for discount", async function() {
        await checkMaxTotalDiscount(accounts[3], 0.5 * MaxDiscountPerToken);
    });

    it("user has 4.2 tokens, expected 4.2*0.1", async function() {
        await checkMaxTotalDiscount(accounts[4], 4.2 * MaxDiscountPerToken);
    });
});

contract("FeePolicy. getFeeDetails", function(accounts) {
    owner = accounts[0];
    manager = accounts[1];
    user = accounts[2];
    feeWallet = accounts[3];

    beforeEach(async function() {        
        await prepare();
    });

    async function checkFeeDetails(expectedFeeEth, expectedDiscountEth, productId=0, payment=utils.toWei(1)) {
        let feeDetails = await feePolicy.getFeeDetails.call(user, productId, payment);
        assert.equal(feeDetails[0].toNumber(), utils.toWei(expectedFeeEth), "invalid fee");
        assert.equal(feeDetails[1].toNumber(), utils.toWei(expectedDiscountEth), "invalid discount");
    }

    it("No tokens, no discount, no custom fee, default fee", async function() {        
        await checkFeeDetails(0.1, 0);
    });

    it("can't call getFeeDetails with invalid productId", async function() {
        await utils.expectContractException(async function() {        
            await checkFeeDetails(0.1, 0, 2);
        });
    });

    it("No discount, default fee + escrow usage", async function() {
        await createProduct({useEscrow:true});

        await checkFeeDetails(0.15, 0, 1);
    });

    it("No discount, default fee + fiat price usage", async function() {
        await createProduct({useFiatPrice:true});
        await checkFeeDetails(0.17, 0, 1);
    });

    it("No discount, default fee + escrow + fiat price usage", async function() {
        await createProduct({useFiatPrice:true, useEscrow:true});
        await checkFeeDetails(0.22, 0, 1);
    });

    it("No tokens, no discount, custom fee applies", async function() {
        await storage.setVendorInfo(user, user, 200);
        await checkFeeDetails(0.2, 0);
    });

    it("No discount, custom fee + escrow + fiat price", async function() {
        await storage.setVendorInfo(user, user, 200);
        await createProduct({useFiatPrice:true, useEscrow:true});
        await checkFeeDetails(0.32, 0, 1);
    });

    it("Less than minimum tokens, no discount, default fee applies", async function() {
        await token.transfer(user, MinTokensForDiscount / 2);
        await checkFeeDetails(0.1, 0); 
    });

    it("Less than minimum tokens, no discount, custom fee applies", async function() {
        await token.transfer(user, MinTokensForDiscount / 2);
        await storage.setVendorInfo(user, user, 300);
        await checkFeeDetails(0.3, 0); 
    });

    it("Enough tokens, discount + default fee applies", async function() {
        await token.transfer(user, MinTokensForDiscount);               
        await checkFeeDetails(0.04, 0.06);
    });

    it("Enough tokens, discount + default fee + escrow usage", async function() {
        await token.transfer(user, MinTokensForDiscount);
        await createProduct({useEscrow:true});
        await checkFeeDetails(0.06, 0.09, 1);
    });

    it("Enough tokens, discount exceeds max for term", async function() {        
        await token.transfer(user, 2 * MinTokensForDiscount);        
        await checkFeeDetails(0.8, 0.2, 0, utils.toWei(10));
    });

    it("Enough tokens, discount + custom fee applies", async function() {
        await token.transfer(user, 20 * MinTokensForDiscount);
        await storage.setVendorInfo(user, user, 300);
        await checkFeeDetails(0.12, 0.18); 
    });

    it("Enough tokens, discount + custom fee applies, discount exceeeds max for term", async function() {
        await token.transfer(user, 4 * MinTokensForDiscount);
        await storage.setVendorInfo(user, user, 200);
        await checkFeeDetails(0.4, 0.4, 0, utils.toWei(4)); 
    });

    it("Enough tokens, total discount for term is above 0 already", async function() {
        await token.transfer(user, MinTokensForDiscount);
        //write some data to totalDiscount, 
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(1));
        assert.equal((await feePolicy.getRemainingDiscount.call(user)).toNumber(), utils.toWei(0.04), "!");

        //now max discount is 0.04
        await checkFeeDetails(0.09, 0.04, 0, utils.toWei(1.3));
    });
});

contract("FeePolicy. calculateFeeAmount", function(accounts) {
    owner = accounts[0];
    manager = accounts[1];
    user = accounts[2];
    let user2 = accounts[4];
    feeWallet = accounts[3]; 

    before(async function() {
        await prepare();
        await token.transfer(user, MinTokensForDiscount);
        await token.transfer(user2, MinTokensForDiscount/2);
        await feePolicy.setManager(manager, true);
    });

    it("check remaining discount = max for the current period", async function() {
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken);
        assert.equal(await feePolicy.getRemainingDiscount.call(user2), 0.5*MaxDiscountPerToken);
    });

    it("remaining discount doesn't change for user without enough tokens", async function() {
        await feePolicy.calculateFeeAmount(user2, 0, utils.toWei(1), {from:manager});
        assert.equal((await feePolicy.getRemainingDiscount.call(user2)).toNumber(), 0.5*MaxDiscountPerToken, "Invalid remaining discount");        
    });

    it("remaining discount decreases after calculateFeeAmount call", async function() {
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(1), {from:manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken - utils.toWei(0.06), "1st call");

        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(0.5), {from:manager}); //discount is 0.5*0.01*0.6 = 0.03
        assert.equal(await feePolicy.getRemainingDiscount.call(user), utils.toWei(0.01), "2nd call");
        
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(0.3), {from:manager}); //discount is 0.3*0.01*0.6 = 0.018, less than remaining
        assert.equal(await feePolicy.getRemainingDiscount.call(user), 0, "3nd call");
    });    

    it("new period starts, remaining discount = max again", async function() {
        await timeutils.timeTravelAndMine(TermDuration);
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken);
    });

    it("remaining discount decreases correctly in new period", async function() {
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(0.9), {from:manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken - utils.toWei(0.054));        
    });

    it("discount can't exceed max", async function() {
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(30), {from:manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(user), 0);
    });

    it("user receives new tokens, discount cap rises", async function() {
        await token.transfer(user, MinTokensForDiscount);
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken, "invalid remaining discount");

        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(1), {from:manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(user), MaxDiscountPerToken - utils.toWei(0.06), "1st call");
    });

    it("user transfers his tokens, remainign discount should be 0", async function() {
        await token.transfer(owner, await utils.TB(token, user), {from:user});
        assert.equal(await feePolicy.getRemainingDiscount.call(user), 0, "invalid remaining discount");
    });

    it("can't call calculateFeeAmount as not manager/owner", async function() {
        await utils.expectContractException(async function() {
            await feePolicy.calculateFeeAmount(user, 0, utils.toWei(1), {from:user});
        });
    });

    it("can't call calculateFeeAmount with invalid product id", async function() {
        await utils.expectContractException(async function() {
            await feePolicy.calculateFeeAmount(user, 10, utils.toWei(1), {from:manager});
        });
    });

    it("can call calculateFeeAmount as owner", async function() {
        await feePolicy.calculateFeeAmount(user, 0, utils.toWei(1), {from:owner});
    });
});


contract("FeePolicy. Measure gas", function(accounts) {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    it("", async function() {
        await prepare(); 
        console.log("FeePolicy: " + web3.eth.getTransactionReceipt(feePolicy.transactionHash).gasUsed);       
    });
});