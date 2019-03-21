let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let timeutils = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

let storage;
let escrowStorage;
let escrowProvider;
let affStorage;
let factory;
let users;

const DefaultFeePermille = 100;
const EscrowFeePermille = 50;
const EscrowBaseFeePermille = 50;
const LegacyEscrowFeePermille = 30;
const LegacyEscrowTimeSeconds = 86400;
const AffiliateFeePermille = 300;
const MinTokensForDiscount = utils.toWei(1);
const TermDuration = 2592000;
const MaxDiscountPerToken = utils.toWei(0.1);
const FeeDiscountPermille = 600;

async function prepare(accounts, options={}) {
    users = utils.makeRoles(accounts);

    token = await utils.createToken();
    storage = await utils.createProductStorage();
    escrowStorage = await utils.createEscrowStorage(users.escrow, EscrowFeePermille);
    escrowProvider = await utils.createEscrowProvider(escrowStorage, users.escrow, LegacyEscrowTimeSeconds, LegacyEscrowFeePermille);
    affStorage = await utils.createAffiliateStorage();
    factory = await utils.createProductFactory(storage, affStorage, escrowStorage);
    
    await createFeePolicy(options);    
    await feePolicy.setManager(users.manager, true);

    await createProduct(options);
}

async function createProduct(options = {}) {
    await utils.createProduct(factory, users, options);
}

async function createFeePolicy(options = {}) {
    feePolicy = await utils.createFeePolicy(
        storage,
        affStorage,
        escrowProvider,
        utils.or(options.defaultFee, DefaultFeePermille),
        utils.or(options.affiliateFee, AffiliateFeePermille),
        utils.or(options.escrowBaseFee, EscrowBaseFeePermille),
        utils.or(options.feeWallet, users.provider), 
        token,
        utils.or(options.minTokens, MinTokensForDiscount),
        utils.or(options.term, TermDuration),
        utils.or(options.maxDiscountPerToken, MaxDiscountPerToken),
        utils.or(options.feeDiscount, FeeDiscountPermille)
    );    
}


contract("FeePolicy. Creation", function(accounts){
    users = utils.makeRoles(accounts);
    before(async function() {
        token = await utils.createToken();
        storage = await utils.createProductStorage();
        escrowStorage = await utils.createEscrowStorage(users.escrow, EscrowFeePermille);
        escrowProvider = await utils.createEscrowProvider(escrowStorage, users.escrow, LegacyEscrowTimeSeconds, LegacyEscrowFeePermille);
        affStorage = await utils.createAffiliateStorage();
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
        assert.equal(await feePolicy.affiliateStorage.call(), affStorage.address, "Invalid affiliate storage");
        assert.equal(await feePolicy.escrowProvider.call(), escrowProvider.address, "Invalid escrow provider");
        assert.equal(await feePolicy.defaultFee.call(), DefaultFeePermille, "Invalid default fee");
        assert.equal(await feePolicy.affiliateFee.call(), AffiliateFeePermille, "Invalid affiliate fee");
        assert.equal(await feePolicy.escrowBaseFee.call(), EscrowBaseFeePermille, "Invalid escrow base fee");
        assert.equal(await feePolicy.feeWallet.call(), users.provider, "Invalid fee wallet");
        assert.equal(await feePolicy.token.call(), token.address, "Invalid token");
        assert.equal(await feePolicy.minTokenForDiscount.call(), MinTokensForDiscount, "Invalid min tokens");
        assert.equal(await feePolicy.termDuration.call(), TermDuration, "Invalid term duration");
        assert.equal(await feePolicy.maxDiscountPerToken.call(), MaxDiscountPerToken, "Invalid max discount per token");
        assert.equal(await feePolicy.discount.call(), FeeDiscountPermille, "Invalid fee discount");
    });

    exceptionOnCreation("can't create feePolicy with default fee > 1000 pm", {defaultFee:1001});
    exceptionOnCreation("can't create feePolicy with affiliate fee > 1000 pm", {affiliateFee:1001});
    exceptionOnCreation("can't create feePolicy with escrow base fee > 1000 pm", {escrowBaseFee:1001});
    exceptionOnCreation("can't create feePolicy with fee discount > 1000 pm", {feeDiscount:1001}); 
    exceptionOnCreation("can't create feePolicy with term duration = 0", {term:0});     
});


async function setFeePolicyParams(options = {}) {
    await feePolicy.setParams(
        utils.or(options.defaultFee, DefaultFeePermille),
        utils.or(options.affiliateFee, AffiliateFeePermille), 
        utils.or(options.escrowBaseFee, EscrowBaseFeePermille), 
        utils.or(options.feeWallet, users.provider), 
        utils.or(options.token, token.address),
        utils.or(options.minTokens, MinTokensForDiscount),
        utils.or(options.maxDiscountPerToken, MaxDiscountPerToken),
        utils.or(options.feeDiscount, FeeDiscountPermille),
        {from: utils.or(options.from, users.owner)}
    );    
}


contract("FeePolicy. Access and restrictions", function(accounts) {
    users = utils.makeRoles(accounts);
    beforeEach(async function() {
        await prepare(accounts);
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
            affiliateFee:256,
            escrowBaseFee:333,
            feeWallet:users.user2,             
            token: newToken.address,
            minTokens:987,
            maxDiscountPerToken:1098832,
            feeDiscount:200,
            from:users.owner}
        );
        
        assert.equal(await feePolicy.productStorage.call(), storage.address, "Invalid storage");
        assert.equal(await feePolicy.defaultFee.call(), 115, "Invalid default fee");
        assert.equal(await feePolicy.affiliateFee.call(), 256, "Invalid affiliate fee"); 
        assert.equal(await feePolicy.escrowBaseFee.call(), 333, "Invalid escrow base fee"); 
        assert.equal(await feePolicy.feeWallet.call(), users.user2, "Invalid fee wallet");
        assert.equal(await feePolicy.token.call(), newToken.address, "Invalid token");
        assert.equal(await feePolicy.minTokenForDiscount.call(), 987, "Invalid min tokens");
        assert.equal(await feePolicy.maxDiscountPerToken.call(), 1098832, "Invalid max total discount");
        assert.equal(await feePolicy.discount.call(), 200, "Invalid fee discount");
    });

    exceptionOnSetParams("can't setParams with default fee > 1000 pm", {defaultFee:1001});    
    exceptionOnSetParams("can't setParams with affiliateFee fee > 1000 pm", {affiliateFee:1001});
    exceptionOnSetParams("can't setParams with fee discount > 1000 pm", {feeDiscount:1001}); 
    exceptionOnSetParams("can't setParams with escrow base fee discount > 1000 pm", {escrowBaseFee:1001}); 
    exceptionOnSetParams("can't setParams if not owner", {from:users.manager});    
});

contract("FeePolicy. Max discount per term", function(accounts) {
    users = utils.makeRoles(accounts);

    before(async function() {
        await prepare(accounts);
        await token.transfer(accounts[2], utils.toWei(2), {from:users.owner});
        await token.transfer(accounts[3], utils.toWei(0.5), {from:users.owner});
        await token.transfer(accounts[4], utils.toWei(4.2), {from:users.owner});    
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
    users = utils.makeRoles(accounts);    
    beforeEach(async function() {        
        await prepare(accounts, {vendor:users.user1});
    });

    async function checkFeeDetails(
        expectedFeeEth, expectedEscrowFeeEth, expectedDiscountEth, productId=0, payment=utils.toWei(1)
    ) {
        let feeDetails = await feePolicy.getFeeDetails.call(users.user1, productId, payment);
        assert.equal(feeDetails[0].toNumber(), utils.toWei(expectedFeeEth), "invalid base fee");
        assert.equal(feeDetails[1].toNumber(), utils.toWei(expectedEscrowFeeEth), "invalid escrow fee");
        assert.equal(feeDetails[2].toNumber(), utils.toWei(expectedDiscountEth), "invalid discount");
    }

    it("No tokens, no discount, no custom fee, default fee", async function() {        
        await checkFeeDetails(0.1, 0, 0);
    });

    it("can't call getFeeDetails with invalid productId", async function() {
        await utils.expectContractException(async function() {        
            await checkFeeDetails(0.1, 0, 0, 2);
        });
    });

    it("No discount, default fee + escrow", async function() {
        await createProduct({useEscrow:true, escrow:users.escrow});        
        await checkFeeDetails(0.15, 0.05, 0, 1);
    });

    it("changing the escrow fee doesn't affect already created products", async function() {
        await createProduct({useEscrow:true, escrow:users.escrow});
        await escrowProvider.update(900, {from:users.escrow});
        await checkFeeDetails(0.15, 0.05, 0, 1);
    });

    it("No tokens, no discount, custom fee applies", async function() {
        await storage.setVendorInfo(users.user1, users.user1, 200);
        await checkFeeDetails(0.2, 0, 0);
    });
    
    it("Less than minimum tokens, no discount, default fee applies", async function() {
        await token.transfer(users.user1, MinTokensForDiscount / 2);
        await checkFeeDetails(0.1, 0, 0); 
    });

    it("Less than minimum tokens, no discount, custom fee applies", async function() {
        await token.transfer(users.user1, MinTokensForDiscount / 2);
        await storage.setVendorInfo(users.user1, users.user1, 300);
        await checkFeeDetails(0.3, 0, 0); 
    });

    it("Enough tokens, discount + default fee applies", async function() {
        await token.transfer(users.user1, MinTokensForDiscount);               
        await checkFeeDetails(0.04, 0, 0.06);
    });

    it("Enough tokens, discount + default fee + escrow", async function() {
        await token.transfer(users.user1, 3 * MinTokensForDiscount);
        await createProduct({useEscrow:true, escrow:users.escrow}); 
        //platform fee is 0.15 = 0.1+0.05 (escrow base)
        //discount for platform fee = 0.6*0.15 = 0,09
        //escrow fee = 0.05
        //discount for escrow fee = 0.6*0.05=0,03
        //resulting platform fee = 0.15-0.09=0.06
        //resulting escrow fee = 0.05-0.03=0.02
        //total discount = 0.09+0.03=0.12 
        await checkFeeDetails(0.06, 0.02, 0.12, 1);
    });

    it("Enough tokens, discount + custom fee applies", async function() {
        await token.transfer(users.user1, 20 * MinTokensForDiscount);
        await storage.setVendorInfo(users.user1, users.user1, 300);
        await checkFeeDetails(0.12, 0, 0.18); 
    });

    it("Enough tokens, discount + custom fee applies, discount exceeeds max for term", async function() {
        await token.transfer(users.user1, 4 * MinTokensForDiscount);
        await storage.setVendorInfo(users.user1, users.user1, 200);
        await checkFeeDetails(0.4, 0, 0.4, 0, utils.toWei(4)); 
    });

    it("Enough tokens, escrow, discount exceeds max for term. first apply to base fee", async function() {        
        await token.transfer(users.user1, 10 * MinTokensForDiscount);
        await createProduct({useEscrow:true, escrow:users.escrow});
                
        //before fee discount: baseFee = 1.5 (1 + 0.5 base escrow), escrowFee = 0.5
        //max discount = 1
        //discount applies first to baseFee. it becomes 1.5 - 0.6*1.5 = 0.6
        //discount for baseFee = 0.9
        //remaining discount = 1-0.9 = 0.1
        //discount applies to escrow fee. it becomes 0.5 - 0.1 = 0.4  
        await checkFeeDetails(0.6, 0.4, 1, 1, utils.toWei(10));        
    });

    it("Enough tokens, escrow, total discount for term is above 0 already, not enough for escrow discount", async function() {
        await token.transfer(users.user1, MinTokensForDiscount);
        await createProduct({useEscrow:true, escrow:users.escrow});

        //max discount is 0.1
        //process payment of 1 eth for non-escrow product, discount = 0.06
        //remaining discount is 0.1-0.06=0.04
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(1));
        assert.equal((await feePolicy.getRemainingDiscount.call(users.user1)).toNumber(), utils.toWei(0.04), "!");

        //check payment of 1.5 eth for escrow product. 
        //baseFee = 0.225(1.5*0.15), discount should be 0.135, but max is 0.04, so it is 0.04
        //base fee after discount is 0.225-0.04=0.185
        //escrow fee got no discount, it is 1.5*0.05=0.075    
        await checkFeeDetails(0.185, 0.075, 0.04, 1, utils.toWei(1.5));
    });
});

contract("FeePolicy. calculateFeeAmount, periods", function(accounts) {    
    users = utils.makeRoles(accounts);
    before(async function() {
        await prepare(accounts);
        await token.transfer(users.user1, MinTokensForDiscount);
        await token.transfer(users.user2, MinTokensForDiscount/2);        
    });

    it("check remaining discount = max for the current period", async function() {
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), MaxDiscountPerToken);
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user2), 0.5*MaxDiscountPerToken);
    });

    it("remaining discount doesn't change for user without enough tokens", async function() {
        await feePolicy.calculateFeeAmount(users.user2, 0, utils.toWei(1), {from:users.manager});
        assert.equal(
            (await feePolicy.getRemainingDiscount.call(users.user2)).toNumber(), 
            0.5*MaxDiscountPerToken, 
            "Invalid remaining discount"
        );        
    });

    it("remaining discount decreases after calculateFeeAmount call", async function() {
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(1), {from:users.manager});
        assert.equal(
            await feePolicy.getRemainingDiscount.call(users.user1), 
            MaxDiscountPerToken - utils.toWei(0.06), 
            "1st call"
        );

        //discount is 0.5*0.01*0.6 = 0.03
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(0.5), {from:users.manager}); 
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), utils.toWei(0.01), "2nd call");
        
        //discount is 0.3*0.01*0.6 = 0.018, less than remaining
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(0.3), {from:users.manager}); 
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), 0, "3nd call");
    });    

    it("new period starts, remaining discount = max again", async function() {
        await timeutils.timeTravelAndMine(TermDuration);
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), MaxDiscountPerToken);
    });

    it("remaining discount decreases correctly in new period", async function() {
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(0.9), {from:users.manager});
        assert.equal(
            await feePolicy.getRemainingDiscount.call(users.user1), 
            MaxDiscountPerToken - utils.toWei(0.054)
        );        
    });

    it("discount can't exceed max", async function() {
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(30), {from:users.manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), 0);
    });

    it("user receives new tokens, discount cap rises", async function() {
        await token.transfer(users.user1, MinTokensForDiscount);
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), MaxDiscountPerToken, "invalid remaining discount");

        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(1), {from:users.manager});
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), MaxDiscountPerToken - utils.toWei(0.06), "1st call");
    });

    it("user transfers his tokens, remaining discount should be 0", async function() {
        await token.transfer(users.owner, await utils.TB(token, users.user1), {from:users.user1});
        assert.equal(await feePolicy.getRemainingDiscount.call(users.user1), 0, "invalid remaining discount");
    });

    it("can't call calculateFeeAmount as not manager/owner", async function() {
        await utils.expectContractException(async function() {
            await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(1), {from:users.user1});
        });
    });

    it("can call calculateFeeAmount as owner", async function() {
        await feePolicy.calculateFeeAmount(users.user1, 0, utils.toWei(1), {from:users.owner});
    });

    it("can't call calculateFeeAmount with invalid product id", async function() {
        await utils.expectContractException(async function() {
            await feePolicy.calculateFeeAmount(users.user1, 10, utils.toWei(1), {from:users.manager});
        });
    });

    it("can't calculateFeeAmount if base fee + escrow fee > 1000", async function() {
        //await escrowProvider.update(999, {from:users.user3});
        await escrowStorage.addEscrow(users.user3, 999);
        await createProduct({useEscrow:true, escrow:users.user3});

        let pid = (await storage.getTotalProducts.call()).toNumber() - 1;
        let totalFee = (await feePolicy.defaultFee.call()).toNumber() + (await escrowProvider.getProductEscrowFee.call(pid)).toNumber();
        assert.isAbove(totalFee, 1000, "total fee should be set above max possible");

        await utils.expectContractException(async function() {
            await feePolicy.calculateFeeAmount(users.user1, pid, utils.toWei(1), {from:users.manager});
        });
    });
});

contract("FeePolicy. sendFee and affiliates", function(accounts) {
    users = utils.makeRoles(accounts);
    let payment = utils.toWei(1);

    async function checkFees(vendor, totalFee, expectedProviderFee, expectdAffiliateFee) {
        let oldProviderBalance = await utils.getBalance(users.provider);
        let oldAffiliateBalance = await utils.getBalance(users.affiliate);

        await feePolicy.sendFee(vendor, {value:totalFee, from:users.manager});

        let newProviderBalance = await utils.getBalance(users.provider);
        let newAffiliateBalance = await utils.getBalance(users.affiliate);

        assert.equal(
            newProviderBalance.minus(oldProviderBalance).toNumber(),
            expectedProviderFee,
            "Invalid provider fee received"
        );

        assert.equal(
            newAffiliateBalance.minus(oldAffiliateBalance).toNumber(),
            expectdAffiliateFee,
            "Invalid affiliate fee received"
        );
    }

    beforeEach(async function() {
        await prepare(accounts, {feeWallet:users.provider, affiliate:users.affiliate, vendor:users.vendor});
    });


    it("affiliated vendor. fee should be split between provider and affiliate", async function() {
        await checkFees(users.vendor, payment, utils.toWei(0.7), utils.toWei(0.3));
    });

    it("event should be emitted if sent to affilate", async function() {
        let tx = await feePolicy.sendFee(users.vendor, {value:payment, from:users.manager});
        let event = tx.logs[0];
        assert.equal(event.event, "AffiliateFeeSent", "Invalid event name");
        assert.equal(event.args.affiliate, users.affiliate, "Invalid event parameter 1");   
        assert.equal(event.args.vendor, users.vendor, "Invalid event parameter 2");   
        assert.equal(event.args.fee, utils.toWei(0.3), "Invalid event parameter 3");   
    });

    it("no affiliate, payment should go to provider only", async function() {
        await createProduct({vendor:users.user1});
        await checkFees(users.user1, payment, payment, 0);
    });

    it("can't call sendFee as non-manager", async function() {
        await utils.expectContractException(async function() {
            await feePolicy.sendFee(users.vendor, {value:payment, from:users.vendor});
        });
    });
});


contract("FeePolicy. Measure gas", function(accounts) {
    users = utils.makeRoles(accounts);

    it("", async function() {
        await prepare(accounts); 
        console.log("FeePolicy: " + web3.eth.getTransactionReceipt(feePolicy.transactionHash).gasUsed);       
    });
});