let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let timeutils = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

const gasPrice = 1000000000;
const E18 = 1000000000000000000;
const MinPoolBalance = utils.toWei(1); //E18; //1 eth
const DiscountsInPool = 1000;
const MaxDiscountPermille = 50;
const LevelTokens = [E18, 2*E18, 3*E18]; 
const LevelPcts = [100, 200, 300];

let pool;
let fund;
let discountPolicy;
let token;
let owner;
let user1;
let user2;
let manager;

async function createDiscountPolicy(options = {}) {    
    return await utils.createDiscountPolicy(
        utils.or(options.minPoolBalance, MinPoolBalance),
        utils.or(options.discountsInPool, DiscountsInPool), 
        utils.or(options.maxDiscountPermille, MaxDiscountPermille), 
        utils.or(options.pool, pool), 
        utils.or(options.token, token), 
        utils.or(options.levelTokens, LevelTokens), 
        utils.or(options.levelPcts, LevelPcts)
    );
}

async function setParams(options = {}) {    
    await discountPolicy.setParams(
        utils.or(options.minPoolBalance, MinPoolBalance),
        utils.or(options.discountsInPool, DiscountsInPool), 
        utils.or(options.maxDiscountPermille, MaxDiscountPermille), 
        utils.or(options.pool, pool.address), 
        utils.or(options.token, token.address), 
        utils.or(options.levelTokens, LevelTokens), 
        utils.or(options.levelPcts, LevelPcts),
        {from:utils.or(options.from, owner)}
    );
}


async function prepare(accounts, intialFunds, options={}) {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    token = await utils.createToken();

    let res = await utils.createFunds();
    pool = res.proxy;
    fund = res.fund;

    discountPolicy = await createDiscountPolicy(options);
    await discountPolicy.setManager(manager, true);

    if(options.noTokenTransfer == undefined) {
        await token.transfer(user1, LevelTokens[0]);
        await token.transfer(user2, LevelTokens[0] / 2);
        await token.transfer(user3, LevelTokens[1]);
        await token.transfer(user4, LevelTokens[2]);
    }    

    await utils.sendEther(owner, fund.address, intialFunds);
}


contract("DiscountPolicy. constructor", function(accounts) {    

    before(async function() {
        token = await utils.createToken();
        let res = await utils.createFunds();
        pool = res.proxy;
        fund = res.fund;
    });

    function testCreate(options, comment) {
        it(`${comment}`, async function() {
            await utils.expectContractException(async function() {
                await createDiscountPolicy(options);
            });
        });
    }

    testCreate(
        {levelTokens:[1, 2], levelPcts:[1]},
        "can't create if tokens.length doesn't match percents.length"
    );

    testCreate(
        {levelTokens:[], levelPcts:[]},
        "can't create if tokens and percents arrays are empty"
    );

    testCreate(
        {levelTokens:[1,2,3,4,5,6,7,8,9,10,11], levelPcts:[1,2,3,4,5,6,7,8,9,10,11]},
        "can't create if tokens and percents arrays are larger than 10 items"
    );

    testCreate(
        {maxDiscountPermille: 1500},
        "can't create if maxDiscountPermille > 1000"
    );

    testCreate(
        {levelTokens:[2, 1], levelPcts:[10, 20]},
        "can't create if token array unordered"
    );

    testCreate(
        {levelTokens:[1, 2], levelPcts:[100, 20]},
        "can't create if percents array unordered"
    );

    it("verifies parameters after creation", async function() {
        discountPolicy = await createDiscountPolicy({});

        assert.equal(await discountPolicy.minPoolBalance.call(), MinPoolBalance, "Invalid minimum pool balance");
        assert.equal(await discountPolicy.discountsInPool.call(), DiscountsInPool, "Invalid discounts in pool");
        assert.equal(await discountPolicy.maxDiscountPermille.call(), MaxDiscountPermille, "Invalid max cashback");
        assert.equal(await discountPolicy.pool.call(), pool.address, "Invalid discount pool");
        assert.equal(await discountPolicy.token.call(), token.address, "Invalid token");

        assert.equal(await discountPolicy.levelTokens.call(0), LevelTokens[0], "Invalid LevelTokens[0]");
        assert.equal(await discountPolicy.levelTokens.call(1), LevelTokens[1], "Invalid LevelTokens[1]");
        assert.equal(await discountPolicy.levelTokens.call(2), LevelTokens[2], "Invalid LevelTokens[2]");

        assert.equal(await discountPolicy.levelPcts.call(0), LevelPcts[0], "Invalid LevelPcts[0]");
        assert.equal(await discountPolicy.levelPcts.call(1), LevelPcts[1], "Invalid LevelPcts[1]");
        assert.equal(await discountPolicy.levelPcts.call(2), LevelPcts[2], "Invalid LevelPcts[2]");
    });
});

contract("DiscountPolicy. setParams", function(accounts) {    
    owner = accounts[0];
    before(async function() {
        await prepare(accounts, 0);
    });

    function testSetParams(options, comment) {
        it(`${comment}`, async function() {
            await utils.expectContractException(async function() {
                await setParams(options);
            });
        });
    }

    testSetParams(
        {levelTokens:[1, 2], levelPcts:[1]},
        "can't setParams if tokens.length doesn't match percents.length"
    );

    testSetParams(
        {levelTokens:[], levelPcts:[]},
        "can't setParams if tokens and percents arrays are empty"
    );

    testSetParams(
        {levelTokens:[1,2,3,4,5,6,7,8,9,10,11], levelPcts:[1,2,3,4,5,6,7,8,9,10,11]},
        "can't setParams if tokens and percents arrays are larger than 10 items"
    );

    testSetParams(
        {maxDiscountPermille: 1500},
        "can't setParams if maxDiscountPermille > 1000"
    );

    testSetParams(
        {levelTokens:[2, 1], levelPcts:[10, 20]},
        "can't setParams if token array unordered"
    );

    testSetParams(
        {levelTokens:[1, 2], levelPcts:[100, 20]},
        "can't setParams if percents array unordered"
    );

    testSetParams(
        {from:accounts[5]},
        "can't setParams if not owner"
    );

    it("verifies parameters after setparams", async function() {
        await setParams( {
            minPoolBalance: MinPoolBalance*3,
            discountsInPool: 2, 
            maxDiscountPermille: 41, 
            pool: accounts[4], 
            token: accounts[5], 
            levelTokens: [10, 20], 
            levelPcts: [50, 60]
        });

        assert.equal(await discountPolicy.minPoolBalance.call(), MinPoolBalance*3, "Invalid minimum pool balance");
        assert.equal(await discountPolicy.discountsInPool.call(), 2, "Invalid discounts in pool");
        assert.equal(await discountPolicy.maxDiscountPermille.call(), 41, "Invalid max cashback");
        assert.equal(await discountPolicy.pool.call(), accounts[4], "Invalid discount pool");
        assert.equal(await discountPolicy.token.call(), accounts[5], "Invalid token");

        assert.equal(await discountPolicy.levelTokens.call(0), 10, "Invalid LevelTokens[0]");
        assert.equal(await discountPolicy.levelTokens.call(1), 20, "Invalid LevelTokens[1]");        

        assert.equal(await discountPolicy.levelPcts.call(0), 50, "Invalid LevelPcts[0]");
        assert.equal(await discountPolicy.levelPcts.call(1), 60, "Invalid LevelPcts[1]");        
    });
});


contract("DiscountPolicy. workflow", function(accounts) {
    
    before(async function() {
        await prepare(accounts, MinPoolBalance);
    });

    it("check policy's discount pool address after creation", async function() {
        assert.equal(pool.address, await discountPolicy.pool.call(), "Invalid discount pool");
        assert.isTrue(await pool.managers.call(discountPolicy.address), "Invalid pool's manager");
    });

    it("check user2 discount. expected: 0 as user has no tokens for discount", async function() {        
        assert.equal(await discountPolicy.getCustomerDiscount.call(user2, E18), 0, "!");
    });

    it("transfer MinTokens to user2 and check the discount. expected: > 0", async function() {
        await token.transfer(user2, LevelTokens[0]);
        assert.equal(
            (await discountPolicy.getLevelPct(user2)).toNumber(),
            LevelPcts[0],
            "Invalid cashback percent"
        );

        assert.equal(
            (await discountPolicy.getCustomerDiscount.call(user2, E18)).toNumber(), 
            MinPoolBalance/DiscountsInPool, 
            "!");
    });

    it("transfer tokens needed for next level to user2 and check the discount increased", async function() {
        await token.transfer(user2, LevelTokens[1]-LevelTokens[0]);
        assert.equal(
            (await discountPolicy.getLevelPct(user2)).toNumber(),
            LevelPcts[1],
            "Invalid cashback percent"
        );

        assert.equal(
            (await discountPolicy.getCustomerDiscount.call(user2, E18)).toNumber(), 
            LevelPcts[1] * MinPoolBalance/DiscountsInPool / 100, 
            "!");
    });

    it("check and request user1 cashback for purchase of 1 ETH. verify event of transaction", async function() {
        let discount = await discountPolicy.getCustomerDiscount.call(user1, E18);
        assert.equal(discount.toNumber(), MinPoolBalance/DiscountsInPool, "!");
    
        let balance = await utils.getBalance(discountPolicy.address);
        let tx = await discountPolicy.requestCustomerDiscount(user1, E18, {from:manager, gasPrice:gasPrice});
        
        let eventArgs = tx.logs[0].args;
        assert.equal(eventArgs.customer, user1, "Invalid event arguments.customer");
        assert.equal(eventArgs.amount.toNumber(), discount.toNumber(), "Invalid event arguments.amount");

        // assert.equal((await discountPolicy.totalCashback.call(user1)).toNumber(), discount.toNumber(), "Invalid cashback added");
        assert.equal((await discountPolicy.totalCashback.call(user1)).toNumber(), 0, "Cashback shouldn't be added");

        assert.equal(
            (await utils.getBalance(discountPolicy.address)).toNumber(), 
            (balance.plus(discount)).toNumber(), 
            "Invalid cashback");
    });

    it("check user1 discount for purchase 1 ETH, expected: 0 as pool balance < min", async function() {
        let discount = await discountPolicy.getCustomerDiscount.call(user1, E18);
        assert.equal(discount.toNumber(), 0, "!");
    });

    it("transfer more ETH to the fund and check the discount", async function() {
        await utils.sendEther(owner, fund.address, E18);
        let discount = await discountPolicy.getCustomerDiscount.call(user1, E18);
        assert.equal(discount.toNumber(), web3.toWei(0.001999), "!");
    });

    it("user1 transfer his tokens, check discount is 0", async function() {
        await token.transfer(owner, LevelTokens[0], {from:user1});        
        let discount = await discountPolicy.getCustomerDiscount.call(user1, E18);
        assert.equal(discount.toNumber(), 0, "!");
    });
});


contract("DiscountPolicy. Minimum pool for discount", function(accounts) {
    before(async function() {
        await prepare(accounts, 0);
    });

    it("check user1 discount. expected: 0 as pool is empty", async function() {        
        assert.equal(await discountPolicy.getCustomerDiscount.call(user1, E18), 0, "!");
    });

    it("transfer less than minimum required amount to pool. discount should be 0", async function() {
        await utils.sendEther(owner, pool.address, MinPoolBalance/2);
        assert.equal(await discountPolicy.getCustomerDiscount.call(user1, E18), 0, "!");
    });

    it("pool gets minimum amount for discount. discount applies now", async function() {
        await utils.sendEther(owner, pool.address, MinPoolBalance/2);
        assert.equal((await discountPolicy.getCustomerDiscount.call(user1, E18)).toNumber(), E18*0.001, "!");
    });

    it("request discount and check the discount, should be 0 as pool gets smaller than min.", async function() {
        await discountPolicy.requestCustomerDiscount(user1, E18, {from:manager, gasPrice:gasPrice});
        assert.equal(await discountPolicy.getCustomerDiscount.call(user1, E18), 0, "!");
    })
});


contract(`DiscountPolicy. 1/${DiscountsInPool} pool, [1,2,3] tokens ~ [100%, 200%, 300%] cashback, Up to ${MaxDiscountPermille/10}%.`, function(accounts) {

    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    before(async function() {
        await prepare(accounts, MinPoolBalance);        
    });
    
    function checkDiscount(user, purchase, expected, comment="") {
        it(`Purchase: ${purchase/E18}. Discount: ${expected/E18}. ${comment}`, async function() {            
            assert.equal(
                (await discountPolicy.getCustomerDiscount.call(user, purchase)).toNumber(), 
                expected,
                "Invalid discount"
            );
        });      
    }

    checkDiscount(user1, E18, E18*0.001, "Enough Tokens");    
    checkDiscount(user1, 2*E18, E18*0.001, "Doesn't depend on purchase");    
    checkDiscount(user1, E18*0.01, E18*0.0005, "cap reached");

    checkDiscount(user3, E18, E18*0.002, "Enough Tokens, Lv.2");    
    checkDiscount(user3, 2*E18, E18*0.002, "Doesn't depend on purchase, Lv.2");
    checkDiscount(user3, E18*0.03, E18*0.0015, "cap reached, Lv.2");

    checkDiscount(user4, E18, E18*0.003, "Enough Tokens, Lv.3");
    checkDiscount(user4, 2*E18, E18*0.003, "Doesn't depend on purchase, Lv.3");
    checkDiscount(user4, E18*0.05, E18*0.0025, "cap reached, Lv.3");    
    
    checkDiscount(user2, E18*0.1, 0, "Not enough tokens");
});


contract("DiscountPolicy. Consecutive requests", function(accounts) {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    before(async function() {
        await prepare(accounts, 2 * MinPoolBalance);        
    });

    function requestDiscount(user, purchase, expected, comment="") {
        it(`Purchase: ${purchase/E18}. Discount: ${expected/E18}. ${comment}`, async function() {
            let discount = (await discountPolicy.getCustomerDiscount.call(user, purchase)).toNumber();
            
            assert.equal(discount, expected,"Invalid discount");

            let balance = await utils.getBalance(discountPolicy.address);
            let tx = await discountPolicy.requestCustomerDiscount(user, purchase, {from:manager, gasPrice:gasPrice});
            
            assert.equal(
                (await utils.getBalance(discountPolicy.address)).toNumber(), 
                (balance.plus(discount)).toNumber(), 
                "Invalid discount withdrawn");
        });
    }

    requestDiscount(user1, utils.toWei(1), utils.toWei(0.002));
    
    requestDiscount(user1, utils.toWei(1), utils.toWei(0.001998));
    
    requestDiscount(user2, utils.toWei(1), 0, "Not enough tokens");
    
    requestDiscount(user1, utils.toWei(0.02), utils.toWei(0.001), "Purchase cap reached");    
    
    requestDiscount(user3, utils.toWei(1), utils.toWei(0.003990004), "Level 2");

    it("verify totalCashback of users", async function() {
        // assert.equal((await discountPolicy.totalCashback.call(user1)).toNumber(), utils.toWei(0.002+0.001998+0.001), "Invalid cashback for user1");
        // assert.equal((await discountPolicy.totalCashback.call(user2)).toNumber(), 0, "Invalid cashback for user2");
        // assert.equal((await discountPolicy.totalCashback.call(user3)).toNumber(), utils.toWei(0.003990004), "Invalid cashback for user3");
        assert.equal((await discountPolicy.totalCashback.call(user1)).toNumber(), 0, "Invalid cashback for user1");
        assert.equal((await discountPolicy.totalCashback.call(user2)).toNumber(), 0, "Invalid cashback for user2");
        assert.equal((await discountPolicy.totalCashback.call(user3)).toNumber(), 0, "Invalid cashback for user3");
    });
});


contract("DiscountPolicy. Withdraw", function(accounts) {
    let cashback1;
    let cashback2;
    let cashback3;
    
    beforeEach(async function() {
        await prepare(accounts, MinPoolBalance*2);        
        await discountPolicy.addCashbacks([user1, user3, user4], [MinPoolBalance/10, MinPoolBalance/2, MinPoolBalance/4]);
        // await discountPolicy.requestCustomerDiscount(user1, E18, {from:manager, gasPrice:gasPrice});
        // await discountPolicy.requestCustomerDiscount(user3, E18, {from:manager, gasPrice:gasPrice});
        // await discountPolicy.requestCustomerDiscount(user4, E18, {from:manager, gasPrice:gasPrice});

        cashback1 = (await discountPolicy.totalCashback.call(user1)).toNumber();
        cashback2 = (await discountPolicy.totalCashback.call(user3)).toNumber();
        cashback3 = (await discountPolicy.totalCashback.call(user4)).toNumber();

        await utils.sendEther(owner, discountPolicy.address, +cashback1+cashback2+cashback3);
    });

    it("reenter attacks, fail as not enough gas for custom fallback function left", async function() {

        let AttackContract = artifacts.require("ErrorCashbackUser");
        let attacker = await AttackContract.new(discountPolicy.address);
        await token.transfer(attacker.address, LevelTokens[0]);

        //await discountPolicy.requestCustomerDiscount(attacker.address, E18, {from:manager, gasPrice:gasPrice});        
        await discountPolicy.addCashbacks([attacker.address], [MinPoolBalance/10]);
        let cashbackA = await discountPolicy.totalCashback.call(attacker.address);        

        let contractBalance = (await utils.getBalance(discountPolicy.address)).toNumber();
        assert.isAbove(cashbackA, 0, "Invalid cashback for attacker");        

        await utils.expectContractException(async function() {
            await attacker.withdraw();
        });        
        assert.equal((await utils.getBalance(discountPolicy.address)).toNumber(), contractBalance, "Invalid balance after attack");
        assert.equal((await discountPolicy.totalCashback.call(attacker.address)).toNumber(), cashbackA.toNumber(), "Cashback for attacker should be untouched");        
    });

    it("user1 withdraws, then user3, then user4, verify ether received", async function() {
        assert.equal((await utils.getBalance(discountPolicy.address)).toNumber(), +cashback1+cashback2+cashback3, "Invalid contract balance");

        let balance1 = await utils.getBalance(user1);
        let balance2 = await utils.getBalance(user3);
        let balance3 = await utils.getBalance(user4);

        let tx = await discountPolicy.withdrawCashback({from:user1, gasPrice:gasPrice});
        assert.equal(
            (await utils.getBalance(user1)).toNumber(),
            balance1.minus(tx.receipt.gasUsed*gasPrice).plus(cashback1).toNumber(),
            "Invalid amount withdrawn for user1"
        );
        assert.equal(await discountPolicy.totalCashback.call(user1), 0, "Total cashback for user1 should be 0");
        assert.equal((await utils.getBalance(discountPolicy.address)).toNumber(), +cashback2+cashback3, "Invalid contract balance after withdraw 1");

        tx = await discountPolicy.withdrawCashback({from:user3, gasPrice:gasPrice});    
        assert.equal(
            (await utils.getBalance(user3)).toNumber(),
            balance2.minus(tx.receipt.gasUsed*gasPrice).plus(cashback2).toNumber(),
            "Invalid amount withdrawn for user3"
        );
        assert.equal(await discountPolicy.totalCashback.call(user3), 0, "Total cashback for user3 should be 0");
        assert.equal((await utils.getBalance(discountPolicy.address)).toNumber(), cashback3, "Invalid contract balance after withdraw 2");

        tx = await discountPolicy.withdrawCashback({from:user4, gasPrice:gasPrice});        
        assert.equal(
            (await utils.getBalance(user4)).toNumber(),
            balance3.minus(tx.receipt.gasUsed*gasPrice).plus(cashback3).toNumber(),
            "Invalid amount withdrawn for user4"
        );
        assert.equal(await discountPolicy.totalCashback.call(user4), 0, "Total cashback for user4 should be 0");
        assert.equal((await utils.getBalance(discountPolicy.address)).toNumber(), 0, "Invalid contract balance after withdraw 3");
    });

    it("user2 has no cashback, withdraws 0", async function() {
        assert.equal(await discountPolicy.totalCashback.call(user2), 0, "Total cashback for user2 should be 0");

        let balance = await utils.getBalance(user2);
        let tx = await discountPolicy.withdrawCashback({from:user2, gasPrice:gasPrice});
        
        assert.equal(
            (await utils.getBalance(user2)).toNumber(),
            balance.minus(tx.receipt.gasUsed*gasPrice).toNumber(),
            "Invalid amount withdrawn"
        );
    });
    
    it("can't withdraw cashback if not enough Ether in the contract", async function() {
        await discountPolicy.addCashbacks([user1], [2*MinPoolBalance]);
        assert.isAbove(
            (await discountPolicy.totalCashback.call(user1)).toNumber(), 
            await utils.getBalance(discountPolicy.address),
            "Invalid balance"
        );

        await utils.expectContractException(async function() {
            await discountPolicy.withdrawCashback({from:user1});
        })
    });

    it("measure gas", async function() {
        let tx = await discountPolicy.withdrawCashback({from:user1});
        console.log("gas used first time: " + tx.receipt.gasUsed);

        await discountPolicy.addCashbacks([user1], [MinPoolBalance/100]);

        tx = await discountPolicy.withdrawCashback({from:user1});
        console.log("gas used second time: " + tx.receipt.gasUsed);
    });
});


contract("DiscountPolicy. AddCashbacks", function(accounts) {
    
    beforeEach(async function() {
        await prepare(accounts, 0);
    })

    it("can't be called by not owner/manager", async function() {
        await utils.expectContractException(async function() {
            await discountPolicy.addCashbacks([user1, user2], [E18/10, E18/10], {from:user1});
        })
    });

    it("can't be called with array of unequal sizes", async function() {
        await utils.expectContractException(async function() {
            await discountPolicy.addCashbacks([user1, user2], [E18/10, E18/10, E18], {from:manager});
        });
    });

    it("verify totalCashback after addCashback", async function() {
        await discountPolicy.addCashbacks([user1, user2], [E18/10, E18/2], {from:manager});
        
        assert.equal(await discountPolicy.totalCashback.call(user1), E18/10, "1. Invalid cashback for user1");
        assert.equal(await discountPolicy.totalCashback.call(user2), E18/2, "1. Invalid cashback for user2");

        await discountPolicy.addCashbacks([user1, user3], [E18/10, E18/4], {from:manager});
        
        assert.equal(await discountPolicy.totalCashback.call(user1), 2*E18/10, "2. Invalid cashback for user1");
        assert.equal(await discountPolicy.totalCashback.call(user3), E18/4, "2. Invalid cashback for user3");
    });

    it("verify addCashback after withdrawal", async function() {
        await utils.sendEther(owner, discountPolicy.address, 2*E18);
        
        let balance1 = await utils.getBalance(user1);
        let balance2 = await utils.getBalance(user2);

        await discountPolicy.addCashbacks([user1, user2], [E18/10, E18/2]);

        let tx1 = await discountPolicy.withdrawCashback({from:user1, gasPrice:gasPrice});
        assert.equal(await discountPolicy.totalCashback.call(user1), 0, "Cashback for user1 should be 0");

        await discountPolicy.addCashbacks([user1, user2, user3], [E18/10, E18/2, E18/20]);
        assert.equal(await discountPolicy.totalCashback.call(user1), E18/10, "Invalid cashback for user1");
        assert.equal(await discountPolicy.totalCashback.call(user2), E18, "Invalid cashback for user1");
        assert.equal(await discountPolicy.totalCashback.call(user3), E18/20, "Invalid cashback for user1");        

        let tx2 = await discountPolicy.withdrawCashback({from:user1, gasPrice:gasPrice});
        let tx3 = await discountPolicy.withdrawCashback({from:user2, gasPrice:gasPrice});

        assert.equal(
            (await utils.getBalance(user1)).toNumber(), 
            balance1.minus(tx1.receipt.gasUsed*gasPrice).minus(tx2.receipt.gasUsed*gasPrice).plus(2*E18/10).toNumber(),
            "Invalid user1 cashback withdrawn"
        );

        assert.equal(
            (await utils.getBalance(user2)).toNumber(), 
            balance2.minus(tx3.receipt.gasUsed*gasPrice).plus(E18).toNumber(),
            "Invalid user2 cashback withdrawn"
        );        
    });

    it("measure gas", async function() {
        let acc10 = [];
        let amounts10 = [];
        for(let i = 0; i < 10; ++i) {
            acc10.push(accounts[i%10]);
            amounts10.push(E18/(i+1));
        }
        let tx = await discountPolicy.addCashbacks(acc10, amounts10);        
        console.log("Gas used for 10 users, first time: " + tx.receipt.gasUsed);

        tx = await discountPolicy.addCashbacks(acc10, amounts10);
        console.log("Gas used for 10 users: " + tx.receipt.gasUsed);


        let acc100 = [];
        let amounts100 = [];
        for(let i = 0; i < 100; ++i) {
            acc100.push(accounts[i%10]);
            amounts100.push(E18/(i+1));
        }
        tx = await discountPolicy.addCashbacks(acc100, amounts100);
        console.log("Gas used for 100 users: " + tx.receipt.gasUsed);
    });
});


contract("DiscountPolicy. Access", function(accounts) {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    beforeEach(async function() {
        await prepare(accounts, MinPoolBalance);
    });

    it("can't requestDiscount as not owner/manager", async function() {
        try {
            await discountPolicy.requestCustomerDiscount(user1, E18, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("can requestDiscount as owner", async function() {        
        await discountPolicy.requestCustomerDiscount(user1, E18, {from:owner});
        assert.equal((await pool.getBalance.call()).toNumber(), utils.toWei(0.999), "!");
    });

    it("can requestDiscount as manager", async function() {        
        await discountPolicy.requestCustomerDiscount(user1, E18, {from:manager});
        assert.equal(await pool.getBalance.call(), utils.toWei(0.999), "!");
    });
});


contract("DiscountPolicy. Measure gas", function(accounts) {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    manager = accounts[3];
    user3 = accounts[4];
    user4 = accounts[5];

    before(async function() {
        await prepare(accounts, 2 * MinPoolBalance);        
    });

    function checkGas(user, purchase, expected, comment="") {
        it(`Purchase: ${purchase/E18}. Discount: ${expected/E18}. ${comment}`, async function() {
            let discount = (await discountPolicy.getCustomerDiscount.call(user, purchase)).toNumber();            
            assert.equal(discount, expected,"Invalid discount");

            let tx = await discountPolicy.requestCustomerDiscount(user, purchase, {from:manager, gasPrice:gasPrice});
            
            console.log("Gas used: " + tx.receipt.gasUsed);
        });
    }
    
    checkGas(user1, utils.toWei(1), utils.toWei(0.002));    
    checkGas(user1, utils.toWei(1), utils.toWei(0.001998));    
    checkGas(user2, utils.toWei(1), 0, "Not enough tokens");    
    checkGas(user1, utils.toWei(0.02), utils.toWei(0.001), "Purchase cap reached");    
    checkGas(user3, utils.toWei(1), utils.toWei(0.003990004), "Level 2");
    checkGas(user4, utils.toWei(2), utils.toWei(0.005973035988), "Level 3"); 
});

contract("DiscountPolicy. Measure gas 10 levels", function(accounts) {
    owner = accounts[0];    
    manager = accounts[1];

    before(async function() {        
        await prepare(
            accounts, 
            2*MinPoolBalance, 
            {
                levelTokens:[E18, 2*E18, 3*E18, 4*E18, 5*E18, 6*E18, 7*E18, 8*E18, 9*E18, 10*E18],
                levelPcts:[100,120,140,160,180,200,220,230,240,260],
                noTokenTransfer: true
            });

        for(let i = 1; i<=9;++i) {
            await token.transfer(accounts[i], i*E18, {from:accounts[0]});
        }
    });

    function checkGas(user, purchase, comment="") {
        it(`Purchase: ${purchase/E18}. ${comment}`, async function() {
            let tx = await discountPolicy.requestCustomerDiscount(user, purchase, {from:manager, gasPrice:gasPrice});
            // console.log((await token.balanceOf.call(user)).toNumber());
            // console.log((await discountPolicy.getLevelPct.call(user)).toNumber());
            console.log("Gas used: " + tx.receipt.gasUsed);
        });
    }

    for(let i = 1; i <= 9; ++i) {
        checkGas(accounts[i], E18, `Level${i}`);
    }
    checkGas(accounts[0], E18, `Level${10}`);
});