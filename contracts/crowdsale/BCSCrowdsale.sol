pragma solidity ^0.4.10;

import '../token/ITokenPool.sol';
import '../token/ReturnTokenAgent.sol';
import '../common/Manageable.sol';
import '../common/SafeMath.sol';
import '../helpers/FakeTime.sol';
import '../crowdsale/IInvestRestrictions.sol';

/**@dev Crowdsale base contract, used for PRE-TGE and TGE stages
* Token holder should also be the owner of this contract */
contract BCSCrowdsale is Manageable, SafeMath, FakeTime {

    enum State {Unknown, BeforeStart, Active, FinishedSuccess, FinishedFailure}
    
    ITokenPool public tokenPool;
    IInvestRestrictions public restrictions; //restrictions on investment
    address public beneficiary; //address of contract to collect ether
    uint256 public startTime; //unit timestamp of start time
    uint256 public endTime; //unix timestamp of end date
    uint256 public minimumGoalInWei; //TODO or in tokens
    uint256 public tokensForOneEther; //how many tokens can you buy for 1 ether   
    uint256 bonusPct;   //additional percent of tokens    

    uint256 public weiCollected;
    uint256 public tokensSold;

    bool public failure; //true if some error occurred during crowdsale

    mapping (address => uint256) public investedFrom; //how many wei specific address invested
    mapping (address => uint256) public tokensSoldTo; //how many tokens sold to specific addreess
    mapping (address => uint256) public overpays;     //overpays for send value excesses

    // A new investment was made
    event Invested(address investor, uint weiAmount, uint tokenAmount);
    // Refund was processed for a contributor
    event Refund(address investor, uint weiAmount);
    // Overpay refund was processed for a contributor
    event OverpayRefund(address investor, uint weiAmount);

    /**@dev Crowdsale constructor, can specify startTime as 0 to start crowdsale immediately */ 
    function BCSCrowdsale(        
        ITokenPool _tokenPool,
        IInvestRestrictions _restrictions,
        address _beneficiary, 
        uint256 _startTime, 
        uint256 _durationInHours, 
        uint256 _goalInWei,
        uint256 _tokensForOneEther,
        uint256 _bonusPct) 
    {
        require(_beneficiary != 0x0);
        require(address(_tokenPool) != 0x0);
        require(_durationInHours > 0);
        require(_tokensForOneEther > 0); 
        
        tokenPool = _tokenPool;
        beneficiary = _beneficiary;
        restrictions = _restrictions;
        
        if (_startTime == 0) {
            startTime = now;
        } else {
            startTime = _startTime;
        }
        endTime = (_durationInHours * 1 hours) + startTime;
        //endTime = (_durationInHours * 1 minutes) + startTime;
        
        tokensForOneEther = _tokensForOneEther;
        minimumGoalInWei = _goalInWei;
        bonusPct = _bonusPct;

        weiCollected = 0;
        tokensSold = 0;
        failure = false;
    }

    function() payable {
        invest();
    }

    function invest() payable {
        require(getState() == State.Active);
        require(address(restrictions) == 0x0 || restrictions.canInvest(msg.sender, msg.value));

        uint256 excess;
        uint256 weiPaid = msg.value;
        uint256 tokensToBuy;
        (tokensToBuy, excess) = howManyTokensForEther(weiPaid);

        require(tokensToBuy <= tokensLeft());

        if (excess > 0) {
            overpays[msg.sender] = safeAdd(overpays[msg.sender], excess);
            weiPaid = safeSub(weiPaid, excess);
        }
        
        investedFrom[msg.sender] = safeAdd(investedFrom[msg.sender], weiPaid);      
        tokensSoldTo[msg.sender] = safeAdd(tokensSoldTo[msg.sender], tokensToBuy);
        
        tokensSold = safeAdd(tokensSold, tokensToBuy);
        weiCollected = safeAdd(weiCollected, weiPaid);

        if(address(restrictions) != 0x0) {
            restrictions.investHappened(msg.sender, msg.value);
        }
        
        require(tokenPool.token().transferFrom(tokenPool, msg.sender, tokensToBuy));

        Invested(msg.sender, weiPaid, tokensToBuy);
    }

    /**@dev Returns how many tokens one can buy for given amount of wei */
    function howManyTokensForEther(uint256 weiAmount) constant returns(uint256 tokens, uint256 excess) {
        uint256 realAmountForOneEther = tokenPool.token().getRealTokenAmount(tokensForOneEther);
        uint256 bpct = getCurrentBonusPct();
        uint256 maxTokens = (tokensLeft() * 100) / (100 + bpct);

        tokens = weiAmount * realAmountForOneEther / 1 ether;
        if (tokens > maxTokens) {
            tokens = maxTokens;
        }

        excess = weiAmount - tokens * 1 ether / realAmountForOneEther;

        tokens = (tokens * 100 + tokens * bpct) / 100;
    }

    function getCurrentBonusPct() constant returns (uint256) {
        return bonusPct;
    }
    
    /**@dev Returns how many tokens left for sale */
    function tokensLeft() constant returns(uint256) {        
        return tokenPool.getTokenAmount();
    }

    /**@dev Returns crowdsale current state */
    function getState() constant returns (State) {
        if (failure) {
            return State.FinishedFailure;
        }
        
        if (now < startTime) {
            return State.BeforeStart;
        } else if (now < endTime && tokensLeft() > 0) {
            return State.Active;
        } else if (weiCollected >= minimumGoalInWei || tokensLeft() <= 0) {
            return State.FinishedSuccess;
        } else {
            return State.FinishedFailure;
        }
    } 

    /**@dev Allows investors to withdraw funds and overpays in case of crowdsale failure */
    function refund() {
        require(getState() == State.FinishedFailure);

        uint amount = investedFrom[msg.sender];
        investedFrom[msg.sender] = 0;        

        if (amount > 0) {
            if (msg.sender.send(amount)) {
                Refund(msg.sender, amount);
            } else {
                investedFrom[msg.sender] = amount; //restore funds in case of failed send
            }
        }
    }

    /**@dev Allows investor to withdraw overpay */
    function withdrawOverpay() {
        uint amount = overpays[msg.sender];
        overpays[msg.sender] = 0;        

        if (amount > 0) {
            if (msg.sender.send(amount)) {
                OverpayRefund(msg.sender, amount);
            } else {
                overpays[msg.sender] = amount; //restore funds in case of failed send
            }
        }
    }

    /**@dev Transfers all collected funds to beneficiary*/
    function transferToBeneficiary() returns (bool) {
        require(getState() == State.FinishedSuccess);

        uint256 amount = amountToBeneficiary();
        if (beneficiary.send(amount)) {
            Refund(beneficiary, amount);
            return true;
        } else {
            failure = true; 
            return false;
        }
    }

    /**@dev Makes crowdsale failed, for emergency reasons */
    function makeFailed() managerOnly {
        failure = true;
    }

    /**@dev Returns funds that should be sent to beneficiary */
    function amountToBeneficiary() constant returns (uint256) {
        return weiCollected;
    }

    /***********************************************************************************************
    * temp dev methods 
    ***********************************************************************************************/
    // function changeEndTime(uint256 newTime) {
    //     endTime = newTime;
    // }
}