let CheckList = artifacts.require("CheckList");

contract("CheckList", function(accounts) {    
    let list;

    let owner = accounts[0];
    let nonowner = accounts[9];
    let address1 = accounts[1];
    let address2 = accounts[2];
    let address3 = accounts[3];
    let address4 = accounts[4];

    it("create list", async function() {
        list = await CheckList.new();        
        assert.isFalse(await list.contains.call(address1), "initially should be false");
    });

    it("set single address1 to true", async function() {
        await list.set(address1, true);
        assert.isTrue(await list.contains.call(address1), "address1 should be true");
    });

    it("set array [address2, address3, address4] to true", async function() {
        var array = [address2, address3, address4];
        await list.setArray(array, true);
        assert.isTrue(await list.contains.call(address2), "address2 should be true");
        assert.isTrue(await list.contains.call(address3), "address3 should be true");
        assert.isTrue(await list.contains.call(address4), "address4 should be true");
    });

    it("set array [address1, address2, address3] to false", async function() {
        var array = [address1, address2, address3];
        await list.setArray(array, false);
        assert.isFalse(await list.contains.call(address1), "address1 should be false");
        assert.isFalse(await list.contains.call(address2), "address2 should be false");
        assert.isFalse(await list.contains.call(address3), "address3 should be false");
    });
    
    it("set single address4 to false", async function() {
        await list.set(address4, false);
        assert.isFalse(await list.contains.call(address4), "address4 should be false");
    });

    it("set as nonowner, should fail", async function() {
        try {
            await list.set(address4, true, {from:nonowner});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });
})

contract("measure gas", function(accounts) {
    it("", async function() {
        let list = await CheckList.new();
        console.log("Creation gas: " + web3.eth.getTransactionReceipt(list.transactionHash).gasUsed);

        let tx = await list.set(accounts[0], true);
        console.log("Single set 'true': " + tx.receipt.gasUsed);

        tx = await list.set(accounts[0], false);
        console.log("Single set 'false': " + tx.receipt.gasUsed);

        var array3 = [accounts[0], accounts[1], accounts[2]];
        var array10 = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4], 
                       accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]];
        tx = await list.setArray(array3, true);
        console.log("Array(3) set 'true': " + tx.receipt.gasUsed);

        tx = await list.setArray(array3, false);
        console.log("Array(3) set 'false': " + tx.receipt.gasUsed);

        tx = await list.setArray(array10, true);
        console.log("Array(10) set 'true': " + tx.receipt.gasUsed);

        tx = await list.setArray(array10, false);
        console.log("Array(10) set 'false': " + tx.receipt.gasUsed);        
    })
})