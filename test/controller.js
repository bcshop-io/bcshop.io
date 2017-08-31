var controller = artifacts.require("BCSCrowdsaleController");

contract('BCSCrowdsaleController', function(accounts) {

    var ownerAccount = accounts[0];
    var beneficiaryAccount = accounts[0];
    var devTokenholder = accounts[0];
    var miscTokenHolder = accounts[1];
    var contrib1 = accounts[2];
    var contrib2 = accounts[3];
    var cobj;

    console.log(devTokenholder);
    it("Token cap should be 3000000", function() {
        return controller.deployed().then(function(instance) {
            return instance.TOKEN_CAP.call();
        }).then(function(value) {
            assert.equal(value, 3000000, "error, not 3000000 cap");
        });
    });
    
    // it("Beneficiary wallet account creation", function() {
    //     return controller.deployed().then(function(instance) {
    //         cobj = instance;            
            
    //         cobj.initBeneficiaries(beneficiaryAccount, devTokenHolder, miscTokenHolder, {from: ownerAccount}).then(function() {
    //             cobj.beneficiary.call() == beneficiaryAccount
    //         });            
    //     });
    // });    

});
