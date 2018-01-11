const Random = artifacts.require("Random");

contract("Random", function(accounts) {
    it("", async function() {
        let  random = await Random.new(1000);
        let min = 1;
        let max = 3;

        for(let i = 0; i < 21; ++i) {
            let tx = await random.getInt(min, max);                    
           // console.log((await random.current.call()).toNumber());
        }

        // tx = await random.getInt(min, max);
        // console.log((await random.state.call()).toNumber());
        // console.log((await random.current.call()).toNumber());

        // tx = await random.getInt(min, max);        
        // console.log((await random.state.call()).toNumber());
        // console.log((await random.current.call()).toNumber());
    })
})