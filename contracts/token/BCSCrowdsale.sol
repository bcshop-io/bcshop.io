pragma solidity ^0.4.10;

import './IERC20Token.sol';
import '../common/Owned.sol';
import '../common/SafeMath.sol';

/**@dev Crowdsale base contract, used for PRE-ICO and ICO stages  
* Token holder allocates specified amount of tokens for sale via ERC20.approve */
contract BCSCrowdsale is Owned, SafeMath {

    enum State {Unknown, BeforeStart, Active, FinishedSuccess, FinishedFailure}

    IERC20Token public token;    
    address public beneficiary; //address of contract to collect ether
    uint256 public startTime; //unit timestamp of start time
    uint256 public endTime; //unix timestamp of end date
    uint256 public minimumGoalInWei; //TODO or in tokens
    uint256 public tokensForOneEther; //how many tokens can you buy fir 1 ether
    uint256 public tokenPriceInWei; //what's the price in wei of one token

    uint256 public weiCollected;
    uint256 public tokensSold;

    bool public failure; //true if some error ocurred during crowdsale

    mapping (address => uint256) public investedFrom; //how many wei specific address invested
    mapping (address => uint256) public tokensSoldTo; //how many tokens sold to specific addreess

    // A new investment was made
    event Invested(address investor, uint weiAmount, uint tokenAmount);
    // Refund was processed for a contributor
    event Refund(address investor, uint weiAmount);

    function BCSCrowdsale(
        address _token,
        address _beneficiary, 
        uint256 _startTime, 
        uint256 _endTime, 
        uint256 _goalInWei,
        uint256 _tokensForOneEther
        ) 
    {
        require(_beneficiary > 0);
        require(_endTime > _startTime);
        require(_tokensForOneEther > 0 );

        token = IERC20Token(_token);
        beneficiary = _beneficiary;
        startTime = _startTime;
        endTime = _endTime;
        tokensForOneEther = _tokensForOneEther;
        minimumGoalInWei = _goalInWei;

        weiCollected = 0;
        tokensSold = 0;
        failure = false;
        tokenPriceInWei = (10**18) / _tokensForOneEther;
    }

    function() payable {
        invest();
    }

    function invest() payable {
        require(msg.value > 0);
        require(getState() == State.Active);

        uint256 weiPaid = msg.value;
        uint256 tokensToBuy = howManyTokensForEther(weiPaid);

        if(tokensToBuy > tokensLeft()) throw;
        
        investedFrom[msg.sender] = safeAdd(investedFrom[msg.sender], weiPaid);      
        tokensSoldTo[msg.sender] = safeAdd(tokensSoldTo[msg.sender], tokensToBuy);
        token.transferFrom(owner, msg.sender, tokensToBuy); 
    }

    /**@dev Returns how many tokens one can buy for given amount of wei */
    function howManyTokensForEther(uint256 weiAmount) constant returns(uint256) {
        return weiAmount / tokenPriceInWei; 
    }
    
    /**@dev Returns how many tokens left for sale */
    function tokensLeft() constant returns(uint256){
        return token.allowance(owner, this);
    }

    /**@dev Returns crowdsale current state */
    function getState() constant returns (State) {
        if(failure) {
            return State.FinishedFailure;
        }
        
        if(now < startTime) {
            return State.BeforeStart;
        } else if(now < endTime && tokensLeft() > 0) {
            return State.Active;
        } else if(weiCollected >= minimumGoalInWei || tokensLeft() <= 0) {
            return State.FinishedSuccess;
        } else {
            return State.FinishedFailure;
        }
    } 

    /**@dev Allows investors to withdraw funds in case of crowdsale failure */
    function refund() {
        require(getState() == State.FinishedFailure);

        uint amount = investedFrom[msg.sender];
        investedFrom[msg.sender] = 0;

        if(amount > 0) {
            if(msg.sender.send(amount)) {
                Refund(msg.sender, amount);
            } else {
                investedFrom[msg.sender] = amount; //restore funds in case of failed send
            }
        }
    }

    /**@dev Transfers all collected funds to benficiary*/
    function transferToBeneficiary() returns (bool){
        require(getState() == State.FinishedSuccess);

        if(beneficiary.send(weiCollected)) {
            Refund(beneficiary, weiCollected);
            return true;
        } else {
            failure = true; 
            return false;
        }
    }
}