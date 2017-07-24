pragma solidity ^0.4.10;

import './BCSCrowdsale.sol';
import './BCSToken.sol';
import '../common/Owned.sol';
import './TrancheWallet.sol';

/**@dev Crowdsale controller, contains information about preico and ico stages and holds token */
contract BCSCrowdsaleController is Owned {

    BCSToken public token;
    BCSCrowdsale public preIcoSale;
    BCSCrowdsale public icoSale;

    uint256 public constant TOKEN_CAP = 3000000; // token cap, according to whitepaper   
    uint256 public constant TOKEN_DEV_RESERVE_PCT = 20; //reserved to dev team, according to whitepaper
    uint256 public constant TOKEN_MISC_RESERVE_PCT = 2; //reserved to advisors etc., according to whitepaper
    uint256 public constant TOKEN_PREICO_SALE_PCT = 12; //we are selling this % during preico
    uint256 public constant PREICO_TOKENS_FOR_ONE_ETHER = 115;
    uint256 public constant ICO_TOKENS_FOR_ONE_ETHER = 100;
    uint256 public constant MINIMUM_SALE_GOAL = 0;
    uint256 public constant DEV_TOKENS_LOCKED_DAYS = 365;
    uint256 public constant TRANCHE_AMOUNT_PCT = 8;
    uint256 public constant TRANCHE_PERIOD_DAYS = 30;
    uint256 public constant FUNDS_COMPLETE_UNLOCK_DAYS = 365;

    LockableWallet public beneficiaryWallet;    
    address public devTeamTokenStorage;
    address public miscTokenStorage;

    function BCSCrowdsaleController() {}

    /**@dev Step 0. Initialize beneficiaries */
    function initBeneficiaries(address _beneficiary, address _devTeamTokenStorage, address _miscTokenStorage) {
        require(address(_beneficiary) != 0 && _devTeamTokenStorage != 0 && _miscTokenStorage != 0);

        devTeamTokenStorage = _devTeamTokenStorage;
        miscTokenStorage = _miscTokenStorage;
        beneficiaryWallet = new TrancheWallet(_beneficiary, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);        
    }

    // function BCSCrowdsaleController(address _beneficiary, address _devTeamTokenStorage, address _miscTokenStorage) {
    //     require(address(_beneficiary) != 0 && _devTeamTokenStorage != 0 && _miscTokenStorage != 0);

    //     devTeamTokenStorage = _devTeamTokenStorage;
    //     miscTokenStorage = _miscTokenStorage;
    //     beneficiaryWallet = new TrancheWallet(_beneficiary, TRANCHE_PERIOD_DAYS, TRANCHE_AMOUNT_PCT);        
    // }

    /**@dev Step 1. Create token */
    function createToken() ownerOnly{
        require(address(token) == 0x0);

        token = new BCSToken(TOKEN_CAP);        
        token.transfer(devTeamTokenStorage, TOKEN_CAP * TOKEN_DEV_RESERVE_PCT / 100);
        token.transfer(miscTokenStorage, TOKEN_CAP * TOKEN_MISC_RESERVE_PCT / 100);
        token.lockTransferFor(devTeamTokenStorage, DEV_TOKENS_LOCKED_DAYS);  //lock dev's tokens
    }

    /**@dev Step 2. Create preico crowdsale */
    function createPreIco(uint256 startTime, uint256 endTime) ownerOnly {
        require(address(preIcoSale) == 0x0);

        preIcoSale = new BCSCrowdsale(token, beneficiaryWallet, startTime, endTime, 0, PREICO_TOKENS_FOR_ONE_ETHER);
        token.approve(preIcoSale, TOKEN_CAP * TOKEN_PREICO_SALE_PCT / 100);        
    }

    /**@dev Step 3. Withdraw funds from preico */
    function finalizePreico() ownerOnly {
        require(preIcoSale.getState() == BCSCrowdsale.State.FinishedSuccess);

        preIcoSale.transferToBeneficiary();                
    }

    /**@dev Step 4. Create ico crowdsale */
    function createIco(uint256 startTime, uint256 endTime) ownerOnly {
        require(now > preIcoSale.endTime());
        require(startTime > preIcoSale.endTime());

        icoSale = new BCSCrowdsale(token, beneficiaryWallet, startTime, endTime, MINIMUM_SALE_GOAL, ICO_TOKENS_FOR_ONE_ETHER);
        token.approve(preIcoSale, 0); //disallow token transfer via preIco contract
        token.approve(icoSale, token.balanceOf(this)); //allow to transfer all remaingin tokens via ico contract
    }

    /**@dev Step 5. Withdraw funds from ico and burn the rest of tokens*/
    function finalizeIco() ownerOnly {        
        require(icoSale.getState() == BCSCrowdsale.State.FinishedSuccess);

        if(icoSale.transferToBeneficiary()) {
            beneficiaryWallet.lock(FUNDS_COMPLETE_UNLOCK_DAYS);

            token.burn(token.balanceOf(this));        
            token.transferOwnership(0x0);
        }
    }    
}