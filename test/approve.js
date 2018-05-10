let VendorApprove = artifacts.require("VendorApprove");

let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

let token;
let approve;
let owner;
let manager;
let approver;
let vendor1;
let vendor2;
let vendor3;

let ApprovalPrice = 1 * utils.E18;

async function prepare(accounts) {
    owner = accounts[0];
    manager = accounts[1];
    approver = accounts[2];
    vendor1 = accounts[3];
    vendor2 = accounts[4];
    vendor3 = accounts[5];

    token = await utils.createToken();    
    approve = await VendorApprove.new(token.address, ApprovalPrice, [approver]);
    await approve.setManager(manager, true);
}

contract("VendorApprove. Constructor and setParams", function(accounts) {

    beforeEach(async function() {
        await prepare(accounts);
    });

    it("verify data after creation", async function() {
        assert.equal(await approve.token.call(), token.address, "Invalid token address");
        assert.equal(await approve.tokensForApproval.call(), ApprovalPrice.toString(), "Invalid approval price");
        assert.isTrue(await approve.allowedUsers.call(approver), "Invalid approver");
        assert.isFalse(await approve.allowedUsers.call(vendor1), "Random user shouldn't be approver"); 
    }); 

    it("verify data after setParams", async function() {
        await approve.setParams(accounts[9], ApprovalPrice/2);
        assert.equal(await approve.token.call(), accounts[9], "Invalid token address");
        assert.equal(await approve.tokensForApproval.call(), (ApprovalPrice/2).toString(), "Invalid approval price");
    });

    it("can't call setParams as not owner", async function() {
        await utils.expectContractException(async function() {
            await approve.setParams(accounts[9], ApprovalPrice/2, {from:manager});
        });
    });

    it("verify data after setAllowedUsers", async function() {
        await approve.setAllowedUsers(true, [vendor1, vendor2, vendor3]);
        assert.isTrue(await approve.allowedUsers.call(vendor1), "vendor1 should be allowed");
        assert.isTrue(await approve.allowedUsers.call(vendor2), "vendor2 should be allowed");
        assert.isTrue(await approve.allowedUsers.call(vendor3), "vendor3 should be allowed");

        await approve.setAllowedUsers(false, [vendor1, vendor2]);
        assert.isFalse(await approve.allowedUsers.call(vendor1), "vendor1 shouldn't be allowed");
        assert.isFalse(await approve.allowedUsers.call(vendor2), "vendor2 shouldn't be allowed");
        assert.isTrue(await approve.allowedUsers.call(vendor3), "vendor3 should be allowed");
    });

    it("can't setAllowedUsers as not owner", async function() {
        await utils.expectContractException(async function() {
            await approve.setAllowedUsers(true, [vendor1, vendor2, vendor3], {from:manager});
        });
    });    
});


contract("VendorApprove. requestApprove", function(accounts) {
    beforeEach(async function() {
        await prepare(accounts);
        await token.transfer(vendor1, ApprovalPrice);
        await token.transfer(vendor2, ApprovalPrice/2);        
    });

    //OK
    it("verify data after requestApprove", async function() {
        await token.approve(approve.address, ApprovalPrice, {from:vendor1});
        let tx = await approve.requestApprove({from:vendor1});
        
        assert.equal(await approve.requests.call(vendor1), ApprovalPrice.toString(), "Invalid requests data");
        assert.equal(await utils.TB(token, vendor1), 0, "Vendor1 should have no tokens");
        assert.equal(await utils.TB(token, approve.address), ApprovalPrice, "Contract should have tokens");

        let event = tx.logs[0];
        assert.equal(event.event, "ApprovalRequested", "Invalid event name");
        assert.equal(event.args.sender, vendor1, "Invalid event sender");
    });

    //no approve
    it("request before approving transfer, should fail", async function() {
        await utils.expectContractException(async function() {
            await approve.requestApprove({from:vendor1});
        });
    });

    //not enough tokens
    it("request while having not enough tokens, should fail", async function() {
        await token.approve(approve.address, ApprovalPrice, {from:vendor2});
        await utils.expectContractException(async function() {
            await approve.requestApprove({from:vendor2});
        });
    });
    
    //already requested
    it("request while having another request pending", async function() {
        await token.transfer(vendor1, ApprovalPrice * 2);
        await token.approve(approve.address, ApprovalPrice * 3, {from:vendor1});
        await approve.requestApprove({from:vendor1});

        await utils.expectContractException(async function() {
            await approve.requestApprove({from:vendor1});
        });
    });
});


contract("VendorApprove. Resolve request", function(accounts) {
    beforeEach(async function() {
        await prepare(accounts);
        await token.transfer(vendor1, ApprovalPrice);
        await token.transfer(vendor2, ApprovalPrice);
        
        await token.approve(approve.address, ApprovalPrice, {from:vendor1});
        await token.approve(approve.address, ApprovalPrice, {from:vendor2});
        
        await approve.requestApprove({from:vendor1});
    });

    //grant approval
    it("grant approval", async function() {
        let tx = await approve.grantApprovals([vendor1], [true], {from:approver});
        let event = tx.logs[0];
        assert.equal(event.event, "ApprovalGranted", "Invalid event name");
        assert.equal(event.args.sender, vendor1, "Invalid request sender");
        assert.equal(event.args.state, true, "Invalid request result");

        assert.equal(await approve.requests.call(vendor1), 0, "Invalid request data");
    });

    //deny approval
    it("deny approval", async function() {
        let tx = await approve.grantApprovals([vendor1], [false], {from:approver});
        let event = tx.logs[0];
        assert.equal(event.event, "ApprovalGranted", "Invalid event name");
        assert.equal(event.args.sender, vendor1, "Invalid request sender");
        assert.equal(event.args.state, false, "Invalid request result");

        assert.equal(await approve.requests.call(vendor1), 0, "Invalid request data");

        assert.equal(await utils.TB(token, vendor1), ApprovalPrice, "User should get back his tokens");
        assert.equal(await utils.TB(token, approve.address), 0, "Contract should have 0 tokens");
    });

    //grant approval as not allowed user, fail
    it("grant approval as not allowed user, should fail", async function() {
        assert.isFalse(await approve.allowedUsers.call(manager), "Manger shouldn't be allowed to approve");
        await utils.expectContractException(async function() {
            await approve.grantApprovals([vendor1], [false], {from:manager});
        });
    });

    //grant multiple approvals
    it("grant multiple approvals", async function() {
        await approve.requestApprove({from:vendor2});
        let tx = await approve.grantApprovals([vendor1, vendor2], [true, false], {from:approver});

        assert.equal(tx.logs.length, 2, "2 events should be emitted");
        assert.equal(await approve.requests.call(vendor1), 0, "Invalid request data for vendor1");
        assert.equal(await approve.requests.call(vendor2), 0, "Invalid request data for vendor2");

        assert.equal(tx.logs[0].args.sender, vendor1, "Invalid request sender 1");
        assert.equal(tx.logs[0].args.state, true, "Invalid request result 1");

        assert.equal(tx.logs[1].args.sender, vendor2, "Invalid request sender 2");
        assert.equal(tx.logs[1].args.state, false, "Invalid request result 2");

        assert.equal(await utils.TB(token, vendor2), ApprovalPrice, "Vendor2 should get back his tokens");
        assert.equal(await utils.TB(token, approve.address), ApprovalPrice, "Contract should have tokens from vendor1");
    });

    //grant multiple approvals if arrays don't match, fail
    it("grant multiple approvals if arrays don't match, fail", async function() {
        await approve.requestApprove({from:vendor2});
        await utils.expectContractException(async function() {
            await approve.grantApprovals([vendor1, vendor2], [false], {from:approver});
        });
    });

    //grant approval without request, fail
    it("grant approval without request, fail", async function() {
        await utils.expectContractException(async function() {
            await approve.grantApprovals([vendor2], [false], {from:approver}); 
        });
    });

    //vendor1 requests, then price changes, vendor1 gots cancel and should receive his initial tokens back
    it("change price after request", async function() {
        await approve.setParams(token.address, ApprovalPrice / 2);
        await approve.grantApprovals([vendor1], [false], {from:approver});

        assert.equal(await approve.requests.call(vendor1), 0, "Invalid request data");
        assert.equal(await utils.TB(token, vendor1), ApprovalPrice, "User should get back his tokens");
        assert.equal(await utils.TB(token, approve.address), 0, "Contract should have 0 tokens");
        assert.equal(await approve.tokensForApproval.call(), (ApprovalPrice/2).toString(), "Invalid approval price");
    });

    //withdraw tokens
    it("withdraw tokens after approval", async function() {
        await approve.grantApprovals([vendor1], [true], {from:approver});
        
        let balance = await utils.TB(token, owner);        
        await approve.withdrawTokens(token.address, owner, ApprovalPrice);

        assert.equal(await utils.TB(token, approve.address), 0, "Contract should have 0 tokens");
        assert.equal(
            (await utils.TB(token, owner)),
            +ApprovalPrice + balance,
            "Invalid tokens withdrawn"
        );
    });
});


contract("VendorApprove. measure gas", function(accounts) {

    beforeEach(async function() {        
        await prepare(accounts);
        await token.transfer(vendor1, ApprovalPrice);
        await token.transfer(vendor2, ApprovalPrice);
        await token.transfer(vendor3, ApprovalPrice);
        
        await token.approve(approve.address, ApprovalPrice, {from:vendor1});
        await token.approve(approve.address, ApprovalPrice, {from:vendor2});
        await token.approve(approve.address, ApprovalPrice, {from:vendor3});
    })

    it("single resolve", async function() {
        let tx;
         
        tx = await approve.requestApprove({from:vendor1});
        console.log("requestApprove gas usage 1: " + tx.receipt.gasUsed);

        tx = await approve.requestApprove({from:vendor2});
        console.log("requestApprove gas usage 2: " + tx.receipt.gasUsed);

        tx = await approve.grantApprovals([vendor1], [true], {from:approver});
        console.log("single grant approval gas: " + tx.receipt.gasUsed);

        tx = await approve.grantApprovals([vendor2], [false], {from:approver});
        console.log("single deny approval gas: " + tx.receipt.gasUsed);
    });

    it("multiple resolve: grant", async function() {
        await approve.requestApprove({from:vendor1});
        await approve.requestApprove({from:vendor2});
        await approve.requestApprove({from:vendor3});

        tx = await approve.grantApprovals([vendor1,vendor2,vendor3], [true,true,true], {from:approver});
        console.log("multiple resolve: grant. gas " + tx.receipt.gasUsed);
    });

    it("multiple resolve: deny", async function() {
        await approve.requestApprove({from:vendor1});
        await approve.requestApprove({from:vendor2});
        await approve.requestApprove({from:vendor3});

        tx = await approve.grantApprovals([vendor1,vendor2,vendor3], [false,false,false], {from:approver});
        console.log("multiple resolve: deny. gas: " + tx.receipt.gasUsed);

        assert.equal(await utils.TB(token, vendor1), ApprovalPrice, "1");
        assert.equal(await utils.TB(token, vendor2), ApprovalPrice, "2");
        assert.equal(await utils.TB(token, vendor3), ApprovalPrice, "3");
    });
});