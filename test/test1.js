var Token = artifacts.require("BCSToken");
var tokenObj;

// contract('BCSTokenTest', function(accounts) {
//     it('check owner', function() {
//         Token.new(10000, 1, {from: accounts[1]}).then(function(tokenInst) {            
//             return tokenInst.owner.call();
//         }).then(function (result) {
//             assert.equal(result, accounts[1], "Check for owner");            
//         })
//     })
// })


// contract('BCSTokenTest', function(accounts) {
//     it('check owner', function() {
//         Token.new(10000, 1, {from: accounts[1]}).then(function(tokenInst) {            
//             tokenInst.owner.call().then(function(result) {
//                 assert.equal(result, accounts[1], "Check for owner");
//             })        
//         })
//     })
// })

contract('BCSTokenTest', function(accounts) {
    it('check owner', async function() {
        
        var tokenInst = await Token.new(10000, 1, {from: accounts[1]});
        var result = await tokenInst.owner.call();            
    
        assert.equal(result, accounts[1], "Check for owner");                
    })
})