const Random = artifacts.require("Random");
const CockFactory = artifacts.require("CockFactory");
const CockStorage = artifacts.require("CockStorage");
const CockFight = artifacts.require("CockFight");
const CockMarket = artifacts.require("CockMarket");
const Token = artifacts.require("CockToken");

const RngSeed = 1237513;
const HealthRngMax = 100;
const MusclesRngMax = 10;
const FatRngMax = 5;
const HealthMultiplier = 50;
const MusclesMultiplier = 5;
const FatMultiplier = 2;
const FreeCocksPerDay = 3;
const TokensForEverybody = 10000000000000000000; //10 tokens
const FightCooldownHours = 1;
const WinBonusPermille = 50;
const FightFee = 1000000000000000000 //1 token
const MinWinNextLeague = 3;
const MarketFeePermille = 100;

let leagueMinWins = [0, 3];
let leagueMaxMatches = [2, 1];
let leagueTimelimits = [30, 30];

// module.exports = async function(deployer, network, accounts) {    

//     await deployer.deploy(CockStorage);
//     let storage = await CockStorage.deployed();
    
//     //deploy contracts
//     await deployer.deploy(Random, RngSeed);    
//     let random = await Random.deployed();    

//     await deployer.deploy(Token, "Cock Token", "CKT", 18);
//     let token = await Token.deployed();

//     await deployer.deploy(CockFactory, storage.address, token.address, random.address, 
//                          HealthRngMax, MusclesRngMax, FatRngMax, 
//                          HealthMultiplier, MusclesMultiplier, FatMultiplier, 
//                          FreeCocksPerDay);                         
//     let factory = await CockFactory.deployed();

//     await deployer.deploy(CockFight, storage.address, token.address, random.address, FightCooldownHours, FightFee, WinBonusPermille);
//     let fightManager = await CockFight.deployed();
//     try {        
//         await fightManager.addLeagues(leagueMinWins, leagueMaxMatches, leagueTimelimits, {from:accounts[0]});
//     } catch(e) {
//         console.log(e);
//     }

//     await deployer.deploy(CockMarket, storage.address, MarketFeePermille);
//     let market = await CockMarket.deployed();
    
//     //set access    
//     await storage.setManager(factory.address, true);
//     await storage.setManager(market.address, true);
//     await storage.setManager(fightManager.address, true);
//     await token.preapprove(factory.address, true);
//     await token.preapprove(fightManager.address, true);
    
//     //mint tokens
//     await token.mint(accounts[0], TokensForEverybody);
//     await token.mint(accounts[1], TokensForEverybody);
//     await token.mint(accounts[2], TokensForEverybody);
//     await token.mint(accounts[3], TokensForEverybody);
//     await token.mint(accounts[4], TokensForEverybody);
//     await token.mint(accounts[5], TokensForEverybody);
//     await token.mint(accounts[6], TokensForEverybody);
//     await token.mint(accounts[7], TokensForEverybody);
//     await token.mint(accounts[8], TokensForEverybody);
//     await token.mint(accounts[9], TokensForEverybody);
// }

let fs = require("fs");

module.exports = async function(deployer, network, accounts) { 
    let info = {
        storage: {},
        token: {},
        fight: {},
        factory: {},
        market: {}
    };

    deployer.deploy(CockStorage).then(function() {
        return deployer.deploy(Random, RngSeed).then(function() {
            return deployer.deploy(Token, "Cock Token", "CKT", 18).then(function() {
                return CockStorage.deployed().then(function(storage) {                    
                    info.storage.address = storage.address;
                    info.storage.abi = CockStorage.abi;
                    //console.log("Storage address is " + storage.address);
                    return Random.deployed().then(function(random) {                        
                        //console.log("Random address is " + random.address);
                        return Token.deployed().then(function(token) {
                            info.token.address = token.address;
                            info.token.abi = Token.abi;
                            //console.log("Token address is " + token.address);                            
                            return deployer.deploy(CockFactory, 
                                storage.address, token.address, random.address,
                                HealthRngMax, MusclesRngMax, FatRngMax, 
                                HealthMultiplier, MusclesMultiplier, FatMultiplier, 
                                FreeCocksPerDay).then(function() {
                                   return CockFactory.deployed().then(function(factory) {
                                        info.factory.address = factory.address;
                                        info.factory.abi = CockFactory.abi;
                                        //console.log("Factory address is " + factory.address);
                                        return deployer.deploy(CockFight, storage.address, token.address, random.address, 
                                            FightCooldownHours, FightFee, WinBonusPermille).then(function() {
                                                return CockFight.deployed().then(function(fightManager) {
                                                    info.fight.address = fightManager.address;
                                                    info.fight.abi = CockFight.abi;
                                                    //console.log("FightManager address is " + fightManager.address);
                                                    return deployer.deploy(CockMarket, storage.address, MarketFeePermille).then(function() {
                                                        CockMarket.deployed().then(async function(market) {
                                                            info.market.address = market.address;
                                                            info.market.abi = CockMarket.abi;
                                                            fs.writeFileSync("contracts.json", JSON.stringify(info, null , '\t'));

                                                            await storage.setManager(factory.address, true);
                                                            await storage.setManager(market.address, true);
                                                            await storage.setManager(fightManager.address, true);
                                                            await token.preapprove(factory.address, true);
                                                            await token.preapprove(fightManager.address, true); 

                                                            await token.mint(accounts[0], TokensForEverybody);
                                                            await token.mint(accounts[1], TokensForEverybody);
                                                            await token.mint(accounts[2], TokensForEverybody);
                                                            await token.mint(accounts[3], TokensForEverybody);
                                                            await token.mint(accounts[4], TokensForEverybody);
                                                            await token.mint(accounts[5], TokensForEverybody);
                                                            await token.mint(accounts[6], TokensForEverybody);
                                                            await token.mint(accounts[7], TokensForEverybody);
                                                            await token.mint(accounts[8], TokensForEverybody);
                                                            await token.mint(accounts[9], TokensForEverybody);              
                                                            
                                                            await factory.create(0, {from:accounts[0]});
                                                            await factory.create(2, {from:accounts[2]});
                                                            await factory.create(3, {from:accounts[3]});
                                                            await factory.create(0, {from:accounts[1]});
                                                            await factory.create(0, {from:accounts[2]});                                                        
                                                            await factory.create(1, {from:accounts[0]});
                                                            await factory.create(3, {from:accounts[2]});
                                                            await factory.create(2, {from:accounts[3]});

                                                            //simulate transfers
                                                            await storage.transfer(2, accounts[0]);
                                                        })
                                                    })
                                                })
                                            })
                                   })
                                }) 
                        
                        })
                    })
                });
            });
        });
    });
}
