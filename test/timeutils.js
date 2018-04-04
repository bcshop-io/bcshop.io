/*
    TimeUtils is a module that allows to manipulate time on TestRPC.
    Usage:
    var utils = new (require('./timeutils.js'))(web3);
    Where web3 is valid web3 object with currentProvider defined

    - timeTravel(seconds) - advances time for given amount of seconds, returns Promise
    
    - timeTravelAndMine(seconds) - advances time for given amount of seconds. Prefererable method. Returns Promise
    It also mines a new block in order to overcome the current bug where 'now' call is not affected right after evm_increaseTime

    - currentTime() - returns current block timestamp, analogue of 'now' in solidity
*/

var TimeUtils = function(web3) {
    this._web3 = web3;
}

TimeUtils.prototype.mineBlock = function() {
    return new Promise((resolve, reject) => {
        this._web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_mine",        
            id: new Date().getTime()
        }, (err, result) => {
            if(err){ return reject(err) }
            return resolve(result)
        });
    })
}

//advances testrpc time for given amount of seconds
TimeUtils.prototype.timeTravel = function(seconds) {
    //console.log(web3);
    return new Promise((resolve, reject) => {
        this._web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds], // 86400 is num seconds in day
            id: new Date().getTime()
        }, (err, result) => {
            if(err) {
                return reject(err) 
            } else {
                return resolve(result)
            }
        });
    })
}

TimeUtils.prototype.timeTravelAndMine = function(seconds) {
    return this.timeTravel(seconds).then(() => this.mineBlock());
}

TimeUtils.prototype.currentTime = function() {
    return this._web3.eth.getBlock(this._web3.eth.blockNumber).timestamp;
}

module.exports = TimeUtils;