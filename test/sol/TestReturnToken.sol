pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/token/BCSBonusToken.sol";
import "../contracts/misc/SimpleReturnAgent.sol";
import "../contracts/helpers/AddressStorage.sol";

//required migrations
//
contract TestReturnToken {

    uint256 public initialBalance = 6 ether;
    uint256 public agentBalance = 5 ether;
    uint256 public initialTokens = 10;
    uint256 public tokensToReturn = 2;

    BCSBonusToken token;
    SimpleReturnAgent agent;

    function TestReturnToken() {}

    function () payable {}

    function beforeAllInit() {
        token = new BCSBonusToken();          
        agent = new SimpleReturnAgent();    
    }

    function testInit() {
        token.setMinter(this, true);
        Assert.isTrue(token.minters(this), "Not a minter");

        agent.transfer(agentBalance);
        Assert.equal(agent.balance, agentBalance, "Invalid agent ether balance");

        token.setReturnAgent(agent);
        Assert.equal(address(agent), address(token.returnAgent()), "Invalid return agent");

        agent.setReturnableToken(token);
        Assert.equal(agent.returnableToken(), address(token), "Invalid agent's returnable token");
    }

    function testMint() {
        Assert.equal(token.balanceOf(this), 0, "Invalid initial balance");

        token.mint(this, initialTokens);
        Assert.equal(token.balanceOf(this), initialTokens, "Invalid token amount");        
    }

    function testReturn() {
        uint256 oldBalance = this.balance;
        
        token.transfer(agent, tokensToReturn);
        Assert.equal(token.balanceOf(this), initialTokens - tokensToReturn, "Invalid token amount after return");
        Assert.equal(token.balanceOf(agent), tokensToReturn, "Invalid agent tokens after return");        
        Assert.equal(this.balance, oldBalance + 1 ether, "Invalid ether balance after return");        
    }

    function testTransferFrom() {
        uint256 oldBalance = this.balance;
        
        uint256 oldTokens = token.balanceOf(this);
        uint256 oldAgentTokens = token.balanceOf(agent);

        Assert.equal(token.allowance(this, this), 0, "Invalid initial allowance");
        token.approve(this, tokensToReturn);
        Assert.equal(token.allowance(this, this), tokensToReturn, "Invalid allowance");

        token.transferFrom(this, agent, tokensToReturn);

        Assert.equal(token.balanceOf(this), oldTokens - tokensToReturn, "Invalid token amount after return");
        Assert.equal(token.balanceOf(agent), oldAgentTokens + tokensToReturn, "Invalid agent tokens after return");        
        Assert.equal(this.balance, oldBalance + 1 ether, "Invalid ether balance after return");
    }

}