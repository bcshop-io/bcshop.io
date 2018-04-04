var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var utils = new (require("./timeutils.js"))(web3);

var Token = artifacts.require("BCSToken");
var token;

var Crowdsale = artifacts.require("BCSAddBonusCrowdsale");
var sale;

var Restrictions = artifacts.require("FloorInvestRestrictions");
var restrictions;

var Pool = artifacts.require("TokenPool");
var pool;

var BToken = artifacts.require("BCSPromoToken");
var btoken;

const OneEther = web3.toWei(1, "ether");
let StartTime = 0;
const DurationHours = 24*28;
const TokenCap = 10000;
const TokensForSale = TokenCap / 2;
const Decimals = 18;
const TokensForOneEther = 100;
let Floor = OneEther / 2;
let BonusPct = 20;
let MaxDecreasePct = 15;
let DecreaseStepPct = 3;
let StepDurationDays = 7;

//var pctSteps = [0,0,0,0];

var owner;
var beneficiary;
var investor1;
var investor2;

const InvestGasLimit = 200000;

//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns given address specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

async function _TBB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await btoken.balanceOf.call(_holder)).toNumber());
    })
}
 
function Prepare(accounts, investSteps, pctSteps, startOffset, minGoal) {
    return new Promise(async (resolve, reject) => {            

        token = await Token.new(TokenCap, Decimals);
        //let totalTokens = (await token.totalSupply.call()).toNumber();        
        let tokensForSale = await _RT(TokensForSale);
        
        pool = await Pool.new(token.address);
        console.log("Pool creation gas: " + web3.eth.getTransactionReceipt(pool.transactionHash).gasUsed);
        assert.equal(await pool.token(), token.address, "Invalid pool token");        

        //restrictions = await Restrictions.new(Floor);

        await token.allowTransferFor(pool.address, true);
        await token.transfer(pool.address, tokensForSale);
        
        var poolTokens = (await token.balanceOf.call(pool.address)).toNumber();
        assert.equal(poolTokens, tokensForSale, "Invalid pool tokens amount");

        btoken = await BToken.new("BCSBONUS TOKEN", "BB", 0);
        await btoken.setMinter(owner, true);        

        StartTime = +utils.currentTime() + startOffset;
        sale = await Crowdsale.new(pool.address, "0x0", beneficiary, StartTime, DurationHours, 
                                    minGoal, TokensForOneEther,BonusPct, MaxDecreasePct, DecreaseStepPct, StepDurationDays, 
                                    investSteps, pctSteps);
        console.log("Sale creation gas: " + web3.eth.getTransactionReceipt(sale.transactionHash).gasUsed);
        //await restrictions.setManager(sale.address, true);
        await pool.setTrustee(sale.address, true);     
        //await btoken.setReturnAgent(sale.address);   
        //await sale.setReturnableToken(btoken.address);
        await token.setReturnAgent(sale.address);
        await sale.setReturnableToken(token.address);

        resolve(true);
    })
}

contract("BCSAddBonusCrowdsale, production settings. ", function(accounts) {
    /*
Week 1: 18%
Week 2: 16%
Week 3: 14%
Week 4: 12%

Additional 2% bonus if at least 1 ETH invested
Additional 1% bonus for the first 24 h
*/
    Floor = 0;
    BonusPct = 18;
    MaxDecreasePct = 6;
    DecreaseStepPct = 2;
    StepDurationDays = 7;
    let investSteps = [1*OneEther];
    let pctSteps = [2];
    owner = accounts[0];
    beneficiary = accounts[1];
    let investor1 = accounts[2];
    let investor2 = accounts[3];
    let investor3 = accounts[4];
    let investor4 = accounts[5];
    let investor5 = accounts[6];
    let investor6 = accounts[7];
    let binvestor1 = accounts[8];
    let binvestor2 = accounts[9];
    let totalInvested = 0;
    let totalInvestments = 0;
    
    let startOffset = 100;
    it("create sale", async function() {
        await Prepare(accounts, investSteps, pctSteps, startOffset, 5 * OneEther);
        // await btoken.mint(binvestor1, 1);
        // await btoken.mint(binvestor2, 10);
        // await btoken.mint(investor1, 50);
        assert.equal(await sale.investSteps.call(0), investSteps[0], "Invalid investsteps[0]");
        assert.equal(await sale.bonusPctSteps.call(0), 2, "Invalid pctsteps[0]");

        assert.equal(await sale.maxDecreasePct.call(), 6, "Invalid max decreasepct");
        assert.equal(await sale.decreaseStepPct.call(), 2, "Invalid decreasepct");
        assert.equal(await sale.stepDuration.call(), 7*86400, "Invalid step duration");
    });

    // it("transfer bcs tokens to the sale in amount equal to total promo tokens", async function() {
    //     let totalPromo = await btoken.totalSupply.call();
    //     await token.transfer(sale.address, await _RT(totalPromo));
    //     assert.equal(await _TB(sale.address), totalPromo * 1000000000000000000);

    //     await token.allowTransferFor(sale.address, true);
    // });
    
    it("check initial state, should be BeforeStart (1)", async function() {
        assert.equal(await sale.getState.call(), 1, "State should be BeforeStart");        
    });

    it("try to invest too early, should fail", async function() {
        try {
            await sale.invest({from:investor1, to:sale.address, value: OneEther});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });
    
    it("advance time ahead to start and check state", async function() {
        await utils.timeTravelAndMine(startOffset);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    })

    // it("buy with promo tokens", async function() {        
    //     var btokens1 = await _TBB(binvestor1);        
    //     let tx = await btoken.transfer(sale.address, btokens1, {from: binvestor1} );
    //     console.log("Promo gas used " + tx.receipt.gasUsed);

    //     assert.equal(await _TB(binvestor1), 1000000000000000000, "BInvestor1 should have 1 BCS token");                
    //     assert.equal(await btoken.balanceOf.call(binvestor1), 0, "Promo investor1 should have 0 promo tokens now");

    //     var btokens2 = await _TBB(binvestor2);
    //     assert.equal(await _TB(binvestor2), 0, "Promo investor2 should have 0 bcs tokens now");

    //     tx = await btoken.transfer(sale.address, btokens2, {from: binvestor2} );
    //     console.log("Promo gas used " + tx.receipt.gasUsed);
    //     assert.equal(await _TB(binvestor2), await _RT(10), "BInvestor2 should have 10 tokens");
    //     assert.equal(await btoken.balanceOf.call(binvestor2), 0, "Promo investor2 should have 0 promo tokens now");        

    //     assert.equal(await _TBB(sale.address), 11, "Sale should have 11 bonus tokens");
    // })

    // it("buy with some fake tokens, should not result in BCS gain", async function() {        
    //     let ftoken = await BToken.new("FAKE", "FT", 0);
    //     await ftoken.setMinter(owner, true);            
            
    //     assert.equal(await _TB(investor1), 0, "Investor1 shoudl have 0 BCS tokens");
    //     await ftoken.mint(investor1, 10);

    //     await ftoken.transfer(sale.address, 5, {from:investor1});
    //     assert.equal(await _TB(investor1), 0, "Investor1 still should have 0 BCS tokens");        
    // })

    function checkBonuses(timeBonusExpected, comment) {
        it(`check bonuses: ${comment}, expected base bonus ${timeBonusExpected}`, async function() {
            //let bonusPct = BonusPct - Math.min(MaxDecreasePct, periodsPassed * DecreaseStepPct);
            assert.equal((await sale.getCurrentBonusPct.call(investSteps[0] - 10000000)).toNumber(), timeBonusExpected, "less than 1 eth -> default bonus");                
            assert.equal((await sale.getCurrentBonusPct.call(1 * OneEther)).toNumber(), timeBonusExpected + pctSteps[0], "1 eth -> default bonus + 2%");            
            assert.equal((await sale.getCurrentBonusPct.call(2 * OneEther)).toNumber(), timeBonusExpected + pctSteps[0], "1+ eth -> default bonus + 2%");            
        });    
    }

    checkBonuses(19, "The first day"); //+1% for 24h

    it("try to invest less than minimum, should fail", async function() {
        try {
            await sale.invest({from:investor1, to:sale.address, value: Floor/2});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    function testInvestment(investor, investment, bonusExpected, amountString) {        
        let name = `${amountString} invested, ${bonusExpected}% expected`;

        it(name, async function() {
            let tokensNow = await _TB(investor);

            let tokensExpected = (100 + bonusExpected) * TokensForOneEther / 100;
            tokensExpected *= investment;
            //let tx = await sale.invest({from:investor, value:investment});            
            let tx = await web3.eth.sendTransaction({from:investor, to:sale.address, value:investment, gas:InvestGasLimit});
            console.log("Gas used " + web3.eth.getTransactionReceipt(tx).gasUsed);
            //console.log("Gas used " + tx.receipt.gasUsed);
            totalInvested += investment;
            totalInvestments++;
            assert.equal(await _TB(investor), tokensNow + tokensExpected, "Invalid tokens received");
        })    
    }

    testInvestment(investor1, OneEther/2, 19, "No Ether bonus");
    testInvestment(investor2, 1*OneEther, 21, "Ether bonus");
    testInvestment(investor3, 3*OneEther, 21, "Ether bonus x3");     

    it("advance time ahead on one day and check bonuses", async function() {
        await utils.timeTravelAndMine(86400);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    });

    checkBonuses(18, "1st period, after 24h");
    testInvestment(investor2, 2*OneEther, 20, "Ether bonus");

    it("advance time ahead on one period and check state", async function() {
        await utils.timeTravelAndMine(StepDurationDays * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    });

    checkBonuses(16, "2nd period");

    it("advance time ahead on less than one period", async function() {
        await utils.timeTravelAndMine(StepDurationDays * 86400 / 10);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    })

    checkBonuses(16, "2nd period again");
    testInvestment(investor1, 2*OneEther, 18, "Ether bonus");

    it("advance time ahead on one period and check state", async function() {
        await utils.timeTravelAndMine(StepDurationDays * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    });

    checkBonuses(14, "3rd period");
    testInvestment(investor3, 3*OneEther, 16, "Ether bonus");
    testInvestment(investor1, OneEther/2, 14, "No Ether bonus");

    it("advance time ahead on one period and check state", async function() {
        await utils.timeTravelAndMine(StepDurationDays * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    });

    checkBonuses(12, "4th period");
    testInvestment(investor6, OneEther/2, 12, "No Ether bonus");
    testInvestment(investor5, 2*OneEther, 14, "Ether bonus");    

    it("try to withdraw before end, should fail", async function() {
        try {
            await sale.transferToBeneficiary();
        } catch(e) {
            return true;
        }
        throw "Should fail";    
    });
    
    it("advance time ahead on 1 period, state should be FinishedSuccess ", async function() {
        assert.equal(await sale.totalInvestments.call(), totalInvestments, "Invalid total investments");
        await utils.timeTravelAndMine(StepDurationDays * 86400);
        assert.equal((await sale.getState.call()).toNumber(), 3, "Sale state should be 'Success'");        
    });

    it("finish and withdraw", async function() { 
        let oldBalance = await web3.eth.getBalance(beneficiary);
        await sale.transferToBeneficiary();
        console.log("Total invested " + totalInvested.toString());
        console.log("Total investments " + totalInvestments.toString());
        assert.equal(await web3.eth.getBalance(beneficiary), +oldBalance + totalInvested, "Invalid investmenst withdrawn");        
        assert.equal(await web3.eth.getBalance(sale.address), 0, "Sale should contain 0 eth");
    });
    

    // it("advance time ahead on 2 periods and check state, bonus should be minimum", async function() {
    //     await utils.timeTravelAndMine(2 * StepDurationDays * 86400);
    //     assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
    // });
    
    // testInvestment(investor2, 4*OneEther, 14, "Ether bonus");
    // testInvestment(investor1, OneEther/2, 12, "No Ether bonus");    

    // it("manually finish as not manager, should fail", async function() {
    //     try {
    //         await sale.finishCrowdsale(true, {from:beneficiary});
    //     } catch(e) {
    //         return true;
    //     }
    //     throw "Should fail";
    // });

    // it("manually finish. state should be FinishedSuccess (3)", async function() {
    //     await sale.finishCrowdsale(true);
    //     assert.equal(await sale.getState.call(), 3, "State should be 'Success'");
    // });

    it("investor send BCS tokens in attempt to exchange for ETH, should fail as transfer is locked", async function() {
        try {
            let tokensBought = await sale.tokensSoldTo.call(investor1);        
            let tx = await token.transfer(sale.address, tokensBought, {from:investor1});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    })
    
    // it("manually enable again", async function() {
    //     await sale.finishCrowdsale(false);
    //     assert.equal(await sale.getState.call(), 2, "State should be 'Active'");
    // })
    // testInvestment(investor5, OneEther/2, 12, "No Ether bonus");
    // testInvestment(investor2, 1*OneEther, 14, "Ether bonus");

    // it("try to withdraw before end, should fail", async function() {
    //     try {
    //         await sale.transferToBeneficiary();
    //     } catch(e) {
    //         return true;
    //     }
    //     throw "Should fail";    
    // });

    // it("finish and withdraw", async function() {
    //     await sale.finishCrowdsale(true);
    //     assert.equal(await sale.getState.call(), 3, "State should be 'Success'");

    //     let oldBalance = await web3.eth.getBalance(beneficiary);
    //     await sale.transferToBeneficiary();
    //     console.log("Total invested " + totalInvested.toString());
    //     assert.equal(await web3.eth.getBalance(beneficiary), +oldBalance + totalInvested, "Invalid investmenst withdrawn");
    // });

    // it("change promo tokens after the end of sale, should fail", async function() {
    //     try {
    //         var btokens1 = await _TBB(investor1);
    //         btokens1 = btokens1 / 10;        
    //         await btoken.transfer(sale.address, btokens1, {from: investor1} );
    //     } catch (e) {
    //         return true;
    //     }
    //     throw "Should fail";
    // })

    it("return unsold BCS tokens as not owner, should fail", async function() {
        try {
            await pool.returnTokensTo(owner, {from:investor1});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    // it("return unsold BCS tokens from the sale", async function() {
    //     let leftTokens = await _RT(await _TBB(investor1));
    //     assert.equal(await _TB(sale.address), leftTokens, "Sale should have some tokens unclaimed");
        
    //     token.transfer(accounts[1], await _TB(owner), {from:owner});
    //     var oldBalance = await _TB(owner);
    //     await sale.returnUnclaimedTokens({from:owner});
    //     var newBalance = await _TB(owner);
        
    //     assert.equal(newBalance, leftTokens + oldBalance, "Unclaimed BCS tokens should be returned to owner");
    // })

    it("return unsold tokens from the pool", async function() {
        var tokensLeft = await pool.getTokenAmount.call();        
        //console.log(tokensLeft);
        var oldBalance = await _TB( owner);
        await pool.returnTokensTo(owner);        
        var newBalance = await _TB( owner);

        var diff = newBalance - oldBalance;
        assert.equal(diff, tokensLeft, "Not bought tokens should be returned to owner");
        assert.equal(await _TB( pool.address), 0, "Pool should be empty");
    });
});



contract("BCSAddBonusCrowdsale, failed sale", function(accounts) {
    Floor = 0;
    let minGoal = 10*OneEther;
    BonusPct = 18;
    MaxDecreasePct = 6;
    DecreaseStepPct = 2;
    StepDurationDays = 7;
    let investSteps = [1*OneEther];
    let pctSteps = [2];
    owner = accounts[0];
    beneficiary = accounts[1];
    let investor1 = accounts[2];
    let investor2 = accounts[3];    
    let investor3 = accounts[4];
    let binvestor1 = accounts[8];
    let binvestor2 = accounts[9];
    let totalInvested = 0;
        
    it("create sale", async function() {
        await Prepare(accounts, investSteps, pctSteps, 0, minGoal);
        await btoken.mint(binvestor1, 1);
        await btoken.mint(binvestor2, 10);
        assert.equal(await sale.investSteps.call(0), investSteps[0], "Invalid investsteps[0]");
        assert.equal(await sale.bonusPctSteps.call(0), 2, "Invalid pctsteps[0]");
        assert.equal(await sale.getState.call(), 2, "State should be 'active'");
    });

    // it("transfer bcs tokens to the sale in amount equal to total promo tokens", async function() {
    //     let totalPromo = await btoken.totalSupply.call();
    //     await token.transfer(sale.address, await _RT(totalPromo));
    //     assert.equal(await _TB(sale.address), totalPromo * 1000000000000000000);
    //     await token.allowTransferFor(sale.address, true);
    // });

    it("some people invest, should be less than goal", async function() {
        await web3.eth.sendTransaction({from:investor1, to:sale.address, value:OneEther, gas:InvestGasLimit});
        await web3.eth.sendTransaction({from:investor2, to:sale.address, value:2*OneEther, gas:InvestGasLimit});
        assert.isBelow((await sale.weiCollected.call()).toNumber(), 
                        (await sale.minimumGoalInWei.call()).toNumber(),
                        "Invested amount should be less than needed");
    });
    
    // it("some people invest with Promo tokens", async function() {
    //     await btoken.transfer(sale.address, 1, {from:binvestor1});
    //     assert.equal(await _TB(binvestor1), await _RT(1), "Promo token investor should get 1 BCS");
    // });

    it("advance time to the end of sale, state should be FinishedFailure", async function() {
        await utils.timeTravelAndMine(DurationHours * 3600);
        assert.equal((await sale.getState.call()).toNumber(), 4, "Sale state should be 'FinishedFailure'");
    });

    // it("end sale, state should be FinishFailure", async function() {
    //     await sale.finishCrowdsale(true);
    //     assert.equal(await sale.getState(), 4, "State should be FinishFailure");
    // });

    // it("enable sale, should be Active", async function() {
    //     await sale.finishCrowdsale(false);
    //     assert.equal(await sale.getState(), 2, "State should be FinishFailure");
    // });
    
    it("unlock token transfer", async function() {
        await token.setLockedState(false);
        assert.isFalse(await token.transferLocked.call(), "Transfer should be unlocked");
        assert.isTrue(await token.canTransfer.call(investor1), "Investor1 should be able to transfer tokens");
        assert.isTrue(await token.canTransfer.call(investor2), "Investor2 should be able to transfer tokens");
    });

    it("investor1 returns BCS tokens", async function() {
        let tokensSold = (await sale.tokensSoldTo.call(investor1)).toNumber();
        let etherReceived = await sale.investedFrom.call(investor1);
        let gasPrice = 10000000;
        assert.equal(await _TB(investor1), tokensSold, "Invalid Investor1 token balance ");
        let oldBalance = await web3.eth.getBalance(investor1);
        let tx = await token.transfer(sale.address, tokensSold, {from:investor1, gasPrice:gasPrice});
        let newBalance = await web3.eth.getBalance(investor1);

        assert.equal(newBalance.toNumber(), 
                    oldBalance.minus(gasPrice*tx.receipt.gasUsed).plus(etherReceived).toNumber(), 
                    "!");
        assert.equal(await sale.investedFrom.call(investor1), 0, "sale.investedFrom should contain 0 for investor1");
        assert.equal((await sale.returnedTo.call(investor1)).toNumber(), etherReceived.toNumber(), "Invalid sale.returnedTo");
    });    

    // it("promo token investor tries to return ether, should fail", async function() {
    //     try {
    //         await token.transfer(sale.address, await _RT(1), {from:binvestor1});
    //     } catch(e) {
    //         return true;
    //     }
    //     throw "Should fail";
    // });
    
    it("investor2 transfers his tokens to investor1. investor1 tries to return tokens, should fail", async function() {
        token.transfer(investor1, await _RT(10), {from:investor2});
        token.transfer(investor3, await _RT(10), {from:investor2});
        try {
            await token.transfer(sale.address, await _RT(10), {from:investor1});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("some other non-buyer person tries to return tokens, should fail", async function() {        
        try {
            await token.transfer(sale.address, await _RT(10), {from:investor3});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("investor2 tries to return ether, should fail because he sends less tokens than bought", async function() {
        try {
            await token.transfer(sale.address, await _TB(investor2), {from:investor2});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("try to withdraw tokens as not owner, should fail", async function() {
        let bcsAmount = await _TB(sale.address);
        try {
            await sale.withdrawTokens(token.address, investor1, bcsAmount, {from:investor1});
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("withdraw bcs and promo from the sale contract", async function() {
        let bcsAmount = await _TB(sale.address);
        //let bcpAmount = await _TBB(sale.address); 

        let oldBcs = await _TB(owner);
        //let oldBcp = await _TBB(owner);

        await sale.withdrawTokens(token.address, owner, bcsAmount);
        //await sale.withdrawTokens(btoken.address, owner, bcpAmount);

        assert.equal((await _TB(owner)), +oldBcs + bcsAmount, "Invalid BCS returned from sale");
        //assert.equal(await _TBB(owner), +oldBcp + bcpAmount, "Invalid BCP returned from sale");

        assert.equal(await _TB(sale.address), 0, "There should be 0 BCS on sale contract");
        //assert.equal(await _TBB(sale.address), 0, "There should be 0 BCP on sale contract");
    });

    it("return unsold tokens from the pool", async function() {
        var tokensLeft = await pool.getTokenAmount.call();        
        
        var oldBalance = await _TB(owner);
        await pool.returnTokensTo(owner);        
        var newBalance = await _TB(owner);

        //var diff = newBalance - oldBalance;
        assert.equal(newBalance, tokensLeft.plus(oldBalance).toNumber(), "Not bought tokens should be returned to owner");
        assert.equal(await _TB( pool.address), 0, "Pool should be empty");
    });

});







// contract("BCSAddBonusCrowdsale", function(accounts) {
//     var investSteps = [1*OneEther,3*OneEther,5*OneEther,7*OneEther];
// var pctSteps = [1,2,3,5];
//     owner = accounts[0];
//     beneficiary = accounts[1];
//     investor1 = accounts[2];
//     investor2 = accounts[3];
//     investor3 = accounts[4];
//     investor4 = accounts[5];
//     investor5 = accounts[6];
//     investor6 = accounts[7];
//     investor7 = accounts[8];
//     investor8 = accounts[9];
//     let totalInvested = 0;
    
//     let startOffset = 100;
//     it("create", async function() {
//         await Prepare(accounts);
//         StartTime = +utils.currentTime() + startOffset;
//         sale = await Crowdsale.new(pool.address, restrictions.address, beneficiary, StartTime, DurationHours, 
//                                     0, TokensForOneEther,BonusPct, MaxDecreasePct, DecreaseStepPct, StepDurationDays, 
//                                     investSteps, pctSteps);
//         await restrictions.setManager(sale.address, true);
//         await pool.setTrustee(sale.address, true);        

//         assert.equal(await sale.investSteps.call(2), investSteps[2], "Invalid investsteps[2]");
//         assert.equal(await sale.investSteps.call(3), investSteps[3], "Invalid investsteps[3]");

//         // assert.equal((await sale.bonusPctSteps.call(1)).toNumber(), 2, "Invalid pctsteps[1]");
//         // assert.equal(await sale.bonusPctSteps.call(2), 3, "Invalid pctsteps[2]");
//     });

//     it("check initial state, should be BeforeStart (1)", async function() {
//         assert.equal(await sale.getState.call(), 1, "State should be BeforeStart");
//     });

//     it("try to invest too early, should fail", async function() {
//         try {
//             await sale.invest({from:investor1, to:sale.address, value: OneEther});
//         } catch (e) {
//             return true;
//         }
//         throw "Should fail";
//     });
    
//     it("advance time ahead to start and check state", async function() {
//         await utils.timeTravelAndMine(startOffset);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     })

//     function checkBonuses(periodsPassed, comment) {
//         it(`check bonuses on the period #${periodsPassed+1}. ${comment}`, async function() {
//             let bonusPct = BonusPct - Math.min(MaxDecreasePct, periodsPassed * DecreaseStepPct);
//             assert.equal((await sale.getCurrentBonusPct.call(investSteps[0] - 10000000)).toNumber(), bonusPct, "less than 1 eth -> default bonus");                
//             assert.equal((await sale.getCurrentBonusPct.call(2 * OneEther)).toNumber(), bonusPct + pctSteps[0], "[1-3) eth -> default bonus + 1%");            
//             assert.equal((await sale.getCurrentBonusPct.call(4 * OneEther)).toNumber(), bonusPct + pctSteps[1], "[3-5) eth -> default bonus + 2%");
//             assert.equal((await sale.getCurrentBonusPct.call(5 * OneEther)).toNumber(), bonusPct + pctSteps[2], "5 eth -> default bonus + 3%");
//             assert.equal((await sale.getCurrentBonusPct.call(6 * OneEther)).toNumber(), bonusPct + pctSteps[2], "[5-7) eth -> default bonus + 3%");
//             assert.equal((await sale.getCurrentBonusPct.call(7 * OneEther)).toNumber(), bonusPct + pctSteps[3], "7 eth -> default bonus + 5%");            
//             assert.equal((await sale.getCurrentBonusPct.call(8 * OneEther)).toNumber(), bonusPct + pctSteps[3], "7+ eth -> default bonus + 5%");
//         });    
//     }

//     checkBonuses(0, "1st period");

//     it("try to invest less than minimum, should fail", async function() {
//         try {
//             await sale.invest({from:investor1, to:sale.address, value: Floor/2});
//         } catch (e) {
//             return true;
//         }
//         throw "Should fail";
//     });

//     function testInvestment(investor, investment, periodsPassed, bonus, amountString) {
//         let totalBonus = bonus - Math.min(MaxDecreasePct, periodsPassed*DecreaseStepPct);
//         let name = `Ether Bonus: ${amountString} invested, period #${periodsPassed+1}, ${totalBonus}% expected`;

//         it(name, async function() {
//             let tokensNow = await _TB(investor);

//             let tokensExpected = (100 + totalBonus) * TokensForOneEther / 100;
//             tokensExpected *= investment;
//             //let tx = await sale.invest({from:investor, value:investment});            
//             let tx = await web3.eth.sendTransaction({from:investor, to:sale.address, value:investment, gas:InvestGasLimit});
//             //console.log("Gas used " + web3.eth.getTransactionReceipt(tx).gasUsed);
//             //console.log("Gas used " + tx.receipt.gasUsed);
//             totalInvested += investment;
            
//             assert.equal(await _TB(investor), tokensNow + tokensExpected, "Invalid tokens received");
//         })    
//     }

//     testInvestment(investor1, Floor,0, BonusPct, "Minimum");
//     testInvestment(investor2, 2*OneEther, 0, +BonusPct + pctSteps[0], "1st step");
//     testInvestment(investor3, 3*OneEther, 0, +BonusPct + pctSteps[1], "2nd step min");
//     testInvestment(investor4, 4*OneEther, 0, +BonusPct + pctSteps[1], "2nd step");
//     testInvestment(investor5, 6*OneEther, 0, +BonusPct + pctSteps[2], "3rd step");
//     testInvestment(investor8, 5*OneEther, 0, +BonusPct + pctSteps[2], "3rd step min");
//     testInvestment(investor6, 7*OneEther, 0, +BonusPct + pctSteps[3], "4th step min");
//     testInvestment(investor7, 8*OneEther, 0, +BonusPct + pctSteps[3], "4th step");

//     it("advance time ahead on one period and check state", async function() {
//         await utils.timeTravelAndMine(StepDurationDays * 86400);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     });

//     checkBonuses(1, "2nd period");

//     it("advance time ahead on less than one period", async function() {
//         await utils.timeTravelAndMine(StepDurationDays * 86400 / 10);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     })

//     checkBonuses(1, "2nd period again");
//     testInvestment(investor1, 2*OneEther, 1, +BonusPct + pctSteps[0], "1st step");

//     it("advance time ahead on one period and check state", async function() {
//         await utils.timeTravelAndMine(StepDurationDays * 86400);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     });

//     checkBonuses(2, "3rd period");
//     testInvestment(investor3, 3*OneEther, 2, +BonusPct + pctSteps[1], "2nd step min");
//     testInvestment(investor1, Floor, 2, BonusPct, "Minimum");

//     it("advance time ahead on 3 periods", async function() {
//         await utils.timeTravelAndMine(3 * StepDurationDays * 86400);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     })

//     checkBonuses(5, "6th period");
//     testInvestment(investor1, 6*OneEther, 5, +BonusPct + pctSteps[2], "3rd step");
//     testInvestment(investor8, 8*OneEther, 5, +BonusPct + pctSteps[3], "4th step");

//     it("advance time ahead on 2 periods and check state, bonus should be minimum", async function() {
//         await utils.timeTravelAndMine(2 * StepDurationDays * 86400);
//         assert.equal((await sale.getState.call()).toNumber(), 2, "Sale state should be 'Active'");
//     });

//     checkBonuses(7, "8th period");
//     testInvestment(investor2, 6*OneEther, 7, +BonusPct + pctSteps[2], "3rd step");

//     it("manually finish as not manager, should fail", async function() {
//         try {
//             await sale.finishCrowdsale(true, {from:beneficiary});
//         } catch(e) {
//             return true;
//         }
//         throw "Should fail";
//     });

//     it("manually finish. state should be FinishedSuccess (3)", async function() {
//         await sale.finishCrowdsale(true);
//         assert.equal(await sale.getState.call(), 3, "State should be 'Success'");
//     });

//     it("manually enable again", async function() {
//         await sale.finishCrowdsale(false);
//         assert.equal(await sale.getState.call(), 2, "State should be 'Active'");
//     });
    
//     testInvestment(investor2, 2*OneEther, 7, +BonusPct + pctSteps[0], "1st step");

//     it("try to withdraw before end, should fail", async function() {
//         try {
//             await sale.transferToBeneficiary();
//         } catch(e) {
//             return true;
//         }
//         throw "Should fail";    
//     });

//     it("finish and withdraw", async function() {
//         await sale.finishCrowdsale(true);
//         assert.equal(await sale.getState.call(), 3, "State should be 'Success'");

//         let oldBalance = await web3.eth.getBalance(beneficiary);
//         await sale.transferToBeneficiary();
//         assert.equal(await web3.eth.getBalance(beneficiary), +oldBalance + totalInvested, "Invalid investmenst withdrawn");
//     });
// });
