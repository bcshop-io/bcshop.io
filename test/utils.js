let __e18 = 1000000000000000000;

let Utils = function(web3, _artifacts) {
    this._web3 = web3;
    this.E18 = __e18;
    if(_artifacts != undefined) {
        artifacts = _artifacts;
    }
}

module.exports = Utils;

module.exports.createWeb3 = 
function(network) {
    let config = require("../truffle.js");
    let networkConfig = config.networks[network];

    let Web3 = require("web3");    
    return new Web3(new Web3.providers.HttpProvider(`http://${networkConfig.host}:${networkConfig.port}`));
}


//
//common methods
//

//returns first parameter if it is not undefined; otherwise returns second
Utils.prototype.or = 
function(value, defaultValue) {
    return value == undefined ? defaultValue : value;
}

//returns value*pm/1000, i.e. permille value  
Utils.prototype.pm = 
function(value, permille) {
    return value * permille / 1000;
}

//returns value*(1000 - pm)/1000, i.e. value - permille discount of it   
Utils.prototype.dpm = 
function(value, permille) {
    return value * (1000 - permille) / 1000;
}



//
//truffle test methods
//

//calls code inside try-catch block, if no transactions exceptions were raised, throws its own
Utils.prototype.expectContractException = 
async function(callback) {
    try {    
        await callback();
    } catch (e) {             
        if(e.toString().indexOf("VM Exception while processing transaction: revert") != -1) {
            return true;
        } else {
            console.log(e); 
        }
    }
    throw "Should fail";
}

Utils.prototype.toWei = 
function(eth) {
    return this._web3.toWei(eth, "ether");
}

Utils.prototype.getBalance = 
async function(user) {
    return this._web3.eth.getBalance(user);
}

Utils.prototype.sendEther = 
function(from, to, value) {
	return this._web3.eth.sendTransaction({from:from, to:to, value:value});
}



//
//product methods
//

//creates bcs token
Utils.prototype.createToken = 
async function(maxSupply=10000, decimals=18) {
    let Token = artifacts.require("BCSToken");
    let token = await Token.new(maxSupply, decimals);
    await token.setLockedState(false);
    return token;
}

//creates fee pool (fund) and discount pool (proxy)
Utils.prototype.createFunds = 
async function(beneficiary=0, beneficiaryShare=0) {
    let EtherFund = artifacts.require("EtherFund");
    let ProxyFund = artifacts.require("ProxyFund");
    let proxy = await ProxyFund.new();
    let etherFund = await EtherFund.new(proxy.address, 1000-beneficiaryShare, beneficiary, beneficiaryShare);
    await proxy.setBaseFund(etherFund.address);
    return {proxy:proxy, fund:etherFund};
}

//creates discountPolicy contract. pool and token are truffle contracts, not just addresses
Utils.prototype.createDiscountPolicy = 
async function(minPoolBalance, discountsInPool, maxDiscountPermille, pool, token, levelTokens, levelPcts) {
    let DiscountPolicy = artifacts.require("DiscountPolicy");
    let discountPolicy = await DiscountPolicy.new(minPoolBalance, discountsInPool, maxDiscountPermille, pool.address, token.address, levelTokens, levelPcts);
    await pool.setManager(discountPolicy.address, true);
    return discountPolicy;
}

//creates new product storage with no managers
Utils.prototype.createProductStorage = 
async function() {
    let ProductStorage = artifacts.require("ProductStorage");
    return await ProductStorage.new({gas:2700000});
}

//creates ProductMaker contract. storages are truffle contractc, not just addresses
Utils.prototype.createProductFactory = 
async function(storage, affStorage, escrowStorage) {
    let Factory = artifacts.require("ProductMaker");
    let factory = await Factory.new(storage.address, affStorage.address, escrowStorage.address);
    await storage.setManager(factory.address, true);
    await affStorage.setManager(factory.address, true);
    await escrowStorage.setManager(factory.address, true);
    return factory;
}

//creates product, 
//factory is ProductMaker truffle contract
//users is result of utils.makeRoles(accounts) call
Utils.prototype.createProduct = 
async function(factory, users, options = {}) {
    let escrowTime = 0;
    let price = 10000;    
    let maxUnits = 10;
    let startTime = 0;
    let endTime   = 0;    
    let active = true;
    let useEscrow = false;
    let useFiatPrice = false;
    let name = "Product1";
    let data = "Address 1|Address 2|Phone";
 
    return await factory.createSimpleProduct(
        this.or(options.price, price),
        this.or(options.maxUnits, maxUnits),
        this.or(options.isActive, active),
        this.or(options.startTime, startTime),
        this.or(options.endTime, endTime),
        this.or(options.useEscrow, useEscrow),
        this.or(options.escrow, "0x0"),
        this.or(options.escrowTime, escrowTime),
        this.or(options.useFiatPrice, useFiatPrice),
        this.or(options.affiliate, "0x0"),
        this.or(options.data, data),
        {from:this.or(options.vendor, users.vendor)}
    );
}

//creates affiliateStorage contract
Utils.prototype.createAffiliateStorage = 
async function() {
    let AffiliateStorage = artifacts.require("AffiliateStorage");
    return await AffiliateStorage.new();
}

Utils.prototype.createRevokedStorage = 
async function() {
    let RevokedStorage = artifacts.require("RevokedStorage");
    return await RevokedStorage.new();
}

//creates escrowStorage contract
Utils.prototype.createEscrowStorage = 
async function(defaultEscrow, defaultEscrowFee=50) {
    let EscrowStorage = artifacts.require("EscrowStorage");
    return await EscrowStorage.new([defaultEscrow], [defaultEscrowFee]);    
}

//creates escrowProvider contract. escrowStorage is truffle contract
Utils.prototype.createEscrowProvider =
async function(escrowStorage, defaultEscrow, legacyHoldTimeSeconds, legacyEscrowFee, resolveTime) {
    let Escrow = artifacts.require("Escrow");
    let escrow = await Escrow.new(escrowStorage.address, defaultEscrow, legacyHoldTimeSeconds, legacyEscrowFee, resolveTime);
    await escrowStorage.setManager(escrow.address, true);

    return escrow;
}

//creates feePolicy contract. 
//token, storage, affStorage, escrowProvider are truffle contracts, not just addresses
Utils.prototype.createFeePolicy = 
async function(
    storage, affStorage, escrowProvider, defaultFee, affFee, escrowBaseFee,  
    feeWallet, token, minTokens, term, maxTotalDiscount, feeDiscount
    ) {
    let FeePolicy = artifacts.require("FeePolicy");
    return await FeePolicy.new(
        storage.address, affStorage.address, escrowProvider.address, defaultFee, affFee,
        escrowBaseFee, feeWallet, token.address, minTokens, term, maxTotalDiscount, feeDiscount
    );
}

//storage, feePolicy, discountPolicy, token, etherPriceProvider - are truffle objects, not addresses
Utils.prototype.createPayment = 
async function(storage, escrowProvider, feePolicy, discountPolicy, revokedStorage, token, etherPriceProvider) {
    let Payment = artifacts.require("ProductPayment");
    
    let payment = await Payment.new(
        storage.address, escrowProvider.address, feePolicy.address, discountPolicy.address, 
        revokedStorage.address, token.address, etherPriceProvider.address, {gas:4000000});
    
    await revokedStorage.setManager(payment.address, true);
    await storage.setManager(payment.address, true);
    await discountPolicy.setManager(payment.address, true);
    await feePolicy.setManager(payment.address, true);

    return payment;
}

Utils.prototype.createEtherPriceProvider = 
async function(rate) {
    let EtherPriceProvider = artifacts.require("EtherPriceProvider");
    let provider = await EtherPriceProvider.new();
    let tx = await provider.updateRate(rate);    
    return provider;
}

//returns token balance of specified user
Utils.prototype.TB = 
function(token, holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(holder)).toNumber());
    })
}

//returns token amount multiplied by 10^decimals
Utils.prototype.RT = 
async function(token, amount) {
    return (await token.getRealTokenAmount.call(amount)).toNumber();
}

//designates roles to accounts, specified by array
Utils.prototype.makeRoles = 
function (accounts) {
    return {
        owner: accounts[0],
        manager: accounts[1],
        user1: accounts[2],
        user2: accounts[3],
        user3: accounts[4],
        escrow: accounts[5],
        affiliate: accounts[6],
        provider: accounts[7],
        vendor: accounts[8],
        bancorOwner: accounts[9]
    };
}

Utils.prototype.gasUsedDeploy = 
function(contract) {
    return this._web3.eth.getTransactionReceipt(contract.transactionHash).gasUsed;
}

Utils.prototype.gasUsedTx = 
function(tx) {
    return tx.receipt.gasUsed;
}



//
// Bancor 
//

Utils.prototype.createBancor = 
async function(owner, bcsOwner, token, payment, artifacts) {    
    const E18 = 1000000000000000000;
    const BNTETH = 200;
    const BCSETH = 100;
    let bcsforOneEther = E18 * BCSETH;
    let bntforOneEther = E18 * BNTETH;
    
    const weight10Percent = 100000;
    const gasPrice = 22000000000;
    const TotalSupply = (await token.totalSupply.call()).toNumber();

    var initialBcs = TotalSupply * 20 / 1000; //2% of total tokens
    var initialBnt1 = TotalSupply; //E18 * 1000; 
    var initialBnt2 = initialBcs * BNTETH / BCSETH;
    var initialEth =  initialBnt1 / BNTETH / 10; //corresponds to 10% connector weight
    var initialBcr = E18 * 100;
    
    let BancorConverter = artifacts.require(`BancorConverter`);
    let SmartToken = artifacts.require(`SmartToken`);    
    let BancorFormula = artifacts.require('BancorFormula');
    let BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
    let BancorQuickConverter = artifacts.require('BancorQuickConverter');
    let BancorConverterExtensions = artifacts.require('BancorConverterExtensions');    
    let EtherToken = artifacts.require("EtherToken");

    //create BNT, with ETH as 10% connector
    let ethToken = await EtherToken.new({from:owner, gas:1182300});
    console.log("EthToken gas used: " + this._web3.eth.getTransactionReceipt(ethToken.transactionHash).gasUsed);
    let bntToken = await SmartToken.new("Bancor Token", "BNT", 18, {from:owner, gas:1301608});
    console.log("BntToken gas used: " + this._web3.eth.getTransactionReceipt(bntToken.transactionHash).gasUsed);
    let formula = await BancorFormula.new({from:owner, gas:3000000});
    console.log("Formula gas used: " + this._web3.eth.getTransactionReceipt(formula.transactionHash).gasUsed);
    let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice, {from:owner, gas:3000000});
    console.log("GasPriceLimit gas used: " + this._web3.eth.getTransactionReceipt(gasPriceLimit.transactionHash).gasUsed);
    let quickConverter = await BancorQuickConverter.new({from:owner, gas:1100000});
    console.log("QuickConverter gas used: " + this._web3.eth.getTransactionReceipt(quickConverter.transactionHash).gasUsed);
    let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address, {from:owner, gas:720000});
    console.log("ConverterExtensions gas used: " + this._web3.eth.getTransactionReceipt(converterExtensions.transactionHash).gasUsed);
    let bntConverter = await BancorConverter.new(bntToken.address, converterExtensions.address,
                    0, ethToken.address, weight10Percent*1, {from:owner, gas:3500000});
    console.log("BNTConverter gas used: " + this._web3.eth.getTransactionReceipt(bntConverter.transactionHash).gasUsed);

    await bntToken.issue(bntConverter.address, initialBnt1, {from:owner});
    await bntToken.issue(bcsOwner, initialBnt2, {from:owner});

    await bntToken.transferOwnership(bntConverter.address, {from:owner});
    await bntConverter.acceptTokenOwnership({from:owner});
    
    await ethToken.deposit({from: owner, value: initialEth});
    await ethToken.transfer(bntConverter.address, initialEth, {from:owner}); 
    
    //create BCSBNT relay (50% BCS, 50% BNT) 
    initialBnt2 = await bntToken.balanceOf.call(bcsOwner);//await _TB(bntToken, bcsOwner);
        
    relayToken = await SmartToken.new("BCS Relay", "BCSBNT", 18, {gas:1350000});
    console.log("RelayToken gas used: " + this._web3.eth.getTransactionReceipt(relayToken.transactionHash).gasUsed);
    formula = await BancorFormula.new({gas:3000000});
    gasPriceLimit = await BancorGasPriceLimit.new(gasPrice, {gas:3000000});
    quickConverter = await BancorQuickConverter.new({gas:1150000});
    converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address, {gas:720000});
    
    let bcsConverter = await BancorConverter.new(relayToken.address, converterExtensions.address, 20000, token.address, weight10Percent*5, {gas:3550000});        
    console.log("BCSConverter gas used: " + this._web3.eth.getTransactionReceipt(bcsConverter.transactionHash).gasUsed);
    await bcsConverter.addConnector(bntToken.address, weight10Percent*5, false);
    //await bcsConverter.setConversionFee(10000);

    await relayToken.issue(bcsConverter.address, initialBcr);
    await relayToken.transferOwnership(bcsConverter.address);
    await bcsConverter.acceptTokenOwnership();
    let quickBuyPath = [
        ethToken.address,
        bntToken.address,
        bntToken.address,
        relayToken.address,
        token.address
    ];
    await bcsConverter.setQuickBuyPath(quickBuyPath);

    //if set to true, quick change to ether results in direct ether send; otherwise, manually withdraw from ethToken
    await quickConverter.registerEtherToken(ethToken.address, true);

    await token.transfer(bcsConverter.address, initialBcs, {from:bcsOwner});
    await bntToken.transfer(bcsConverter.address, initialBnt2, {from:bcsOwner});
    console.log("BNT deposited to BCSRelay: " + initialBnt2.toString());
    console.log("ETH in BNT relay: " + initialEth.toString());

    let quickSellPath = [
        token.address, 
        relayToken.address, 
        bntToken.address, 
        bntToken.address, 
        ethToken.address
    ];
    //await payment.setConvertParams(quickConverter.address, quickSellPath); 
    await payment.setConvertParams(bcsConverter.address, quickSellPath);

    return {
        ethToken: ethToken,
        bntToken: bntToken,
        bcsConverter: bcsConverter,
        bntConverter: bntConverter,
        quickConverter : quickConverter,
        relayToken: relayToken,
        extensions: converterExtensions,
        gasPriceLimit: gasPriceLimit
    };
}

//returns how many BCS will be received in exchange for specific amount of eth
//bancor object contains data according to return value of Utils.createBancor 
Utils.prototype.getBancorBcs = 
async function(bcsToken, bancor, amount = __e18) {
    let bntExpected = await bancor.bntConverter.getReturn(bancor.ethToken.address, bancor.bntToken.address, amount);
    let bcsExpected = await bancor.bcsConverter.getReturn(bancor.bntToken.address, bcsToken.address, bntExpected);        
    return bcsExpected.toNumber();
}

//returns how many WEI costs one bcs in bancor system
//bancor object contains data according to return value of Utils.createBancor 
Utils.prototype.getBancorEth = 
async function(bcsToken, bancor, amount = __e18) {
    let bntExpected = await bancor.bcsConverter.getReturn(bcsToken.address, bancor.bntToken.address, amount);    
    let ethExpected = await bancor.bntConverter.getReturn(bancor.bntToken.address, bancor.ethToken.address, bntExpected);
    return ethExpected.toNumber();
}


//returns how many BCS (*E18) can be approximately exchanged to receive given amount of ETH
//returns 5% more tokens to ensure that there would be enough tokens for purchase
Utils.prototype.calculateBancorBcsForEth = 
async function (bcsToken, bancor, ethAmount) {
    //console.log("We need bcs for " + ethAmount/__e18);
    let precision = 0.001 * ethAmount;
    let rate = await this.getBancorEth(bcsToken, bancor, __e18);
    let tokenValue = ethAmount / rate * __e18;
    //console.log("tokenValue: " + tokenValue);
    let attempts = 0;
    while(attempts < 10)
    {
        //console.log(attempts);
        ++attempts;
        //compare tokenValue with its bancor rate and if it doesn't match then change the value
        let tokenValueEth = await this.getBancorEth(bcsToken, bancor, tokenValue);
        //console.log("We have bcs for " + tokenValueEth/__e18);
       // console.log("Precision " + Math.abs(tokenValueEth-ethAmount)/ethAmount);
        if(Math.abs(tokenValueEth-ethAmount) < precision) {
            break;
        } else {
            tokenValue = tokenValue * ethAmount/tokenValueEth;
          //  console.log("New tokenValue: " + tokenValue);
        } 
    } 

    return tokenValue*1.05;
}

//returns how many ETH (*E18) can be approximately exchanged to receive given amount of BCS
//returns 5% more tokens to ensure that there would be enough tokens for purchase
Utils.prototype.calculateBancorEthForBcs = 
async function (bcsToken, bancor, bcsAmount) {
    //console.log("We need bcs for " + ethAmount/__e18);
    let precision = 0.001 * bcsAmount;
    let rate = await this.getBancorBcs(bcsToken, bancor, __e18);
    let ethValue = bcsAmount / rate * __e18;
    //console.log("ethValue: " + ethValue);
    let attempts = 0;
    while(attempts < 10)
    {
        //console.log(attempts);
        ++attempts;
        //compare ethValue with its bancor rate and if it doesn't match then change the value
        let ethValueBcs = await this.getBancorBcs(bcsToken, bancor, ethValue);
        //console.log("We have bcs for " + ethValueBcs/__e18);
       // console.log("Precision " + Math.abs(ethValueBcs-bcsAmount)/bcsAmount);
        if(Math.abs(ethValueBcs-bcsAmount) < precision) {
            break;
        } else {
            ethValue = ethValue * bcsAmount/ethValueBcs;
          //  console.log("New ethValue: " + ethValue);
        } 
    } 

    return ethValue*1.05;
}

//returns maximum amount of ETH that BCS converter is able to return
Utils.prototype.getBancorMaxEth = 
async function(bancor) {
    let bnt = await this.TB(bancor.bntToken, bancor.bcsConverter.address);
    return await bntConverter.getReturn(bancor.bntToken.address, bancor.ethToken.address, bnt);
}

/*
String extension methods
*/
// String.prototype.FromUTFBytes = function FromUTFBytes() {
// 	let bytesRes = this.slice(2);
// 	let converted = "";
// 	for(let i = 0; i < bytesRes.length; i+=2) {
// 		let char = "0x" + bytesRes.substr(i, 2);
// 		if(char == "0x00") break;		
// 		converted = converted + String.fromCharCode(char);
// 	}

// 	return converted;
// };

