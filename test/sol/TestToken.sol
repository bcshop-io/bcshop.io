pragma solidity ^0.4.10;
import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/token/BCSToken.sol"; 
import "../contracts/helpers/AddressStorage.sol"; 

contract TestToken {

    uint256 tokenCap = 3000000;
    uint256 decimals = 0;
    BCSToken token;
    address holder1;
    address holder2;

    function TestToken() {
        AddressStorage asr = AddressStorage(DeployedAddresses.AddressStorage());
        holder1 = asr.address1();
        holder2 = asr.address2();
    }

    function testConstructor() {
        token = new BCSToken(tokenCap, decimals);

        Assert.equal(token.totalSupply(), TOKEN_CAP, "Invalid token cap");
    }

    function testSend() {
        uint amount = 10000;
        uint oldBalance = token.balanceOf(this);

        token.transfer(holder2, amount);

        Assert.equal(token.balanceOf(holder2), amount, "100 tokens weren't received");
        Assert.equal(token.balanceOf(this), oldBalance - amount, "100 tokens weren't sent");
    }

    function testLock() {
        uint lockDays = 5;
        uint amount = 1000;
        uint oldBalance = token.balanceOf(this);
        token.lockTransferFor(this, lockDays);

        //token.transfer(holder2, amount); //this would throw
        //Assert.equal(token.balanceOf(this), oldBalance, "No tokens should be sent");

        token.setNowTime(token.getNowTime() + lockDays * 1 days + 1 seconds);
        token.transfer(holder2, amount); //this would not throw
        Assert.equal(token.balanceOf(this), oldBalance - amount, "1000 tokens should be sent");
    }

    function testBurn() {
        uint burnAmount = 3000;
        uint oldBalance = token.balanceOf(this);
        
        token.burn(burnAmount); 
        Assert.equal(token.balanceOf(this), oldBalance - burnAmount, "Should be less by 3000");

        token.burn(token.balanceOf(this));
        Assert.equal(token.balanceOf(this), 0, "Should be 0");
    }
}
