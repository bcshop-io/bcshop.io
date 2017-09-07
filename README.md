# Quick docs

1.	token/ERC20StandardToken is common ERC20 implementation. The children contracts usually override the doTransfer function to insert their code.
2.	token/BCSToken is the token distributed during crowdsale (we call them TGE - token generation event - for legal reasons)
3.	token/BCSBonusToken is the so-called bonus token that is distributed before TGE as a demonstration of the platform core functionality. During TGE it can be traded for BCSToken (1:1 ratio).
4.	token/BCSPreTgeToken - not needed
5.	token/ReturnableToken is the ancestor contract of BCSBonusToken which supports tradable behavior.
6.	token/ReturnTokenAgent is the contract that should be inherited in order to be able to accept tradable tokens and do something in response. One of the examples of such inheritance is crowdsale/BCSTokenCrowdsale.sol
7.	token/TokenPool is the token storage that can be shared among several crowdsales.
8.	token/ValueToken is token that represents shares in distribution of some values. The ancestor of BCSToken. This abstraction is used in token/DividendWallet contract.
9.	token/ValueTokenAgent - used in ValueToken to watch the transfer process
10.	 token/DividendWallet - represents a wallet that relies on BCSToken (or any ValueToken in general) to distribute its ether among the token holders. Its 2 children are DividendWalletFixed.sol and DividendWalletFloating.sol. The first one is not planned to be used now, it relies on fixed token supply while the second one assumes that token's supply could be changed.
11.	crowdsale/BCSCrowdsale is the base TGE contract. It accepts ether and in response transfers token from its pool
12.	crowdsale/BCSTokenCrowdsale is used when we want to accept some tokens as a payment in addition to ether (like BCSBonusToken). Example of its usage can be found in test/tge.js. In addition to BCSBonusToken it also accepts BCSPreTgeToken (but please pay no attention to it, the process is absolutely the same)
13.	 crowdsale/BCSTgeCrowdsale - is crowdsale with variable bonuses.
14.	crowdsale/IInvestRestrictions is the abstraction of crowdsale restrictions. Its children are FloorInvestRestrictions and ParticipantInvestRestrictions. Example of its usage can be found in test/restrictions.js
15.	 crowdsale/TrancheWallet is wallet that allows withdrawal in small amounts (tranches). Funds raised during crowdsale go here.
16.	 shop/Vendor is a part of our core functionality. this contract creates Product contracts. Its child TokenVendor is used to create our special sales of BCSBonusToken.
17.	shop/Product is also a part of our core functionality and represents digital service or goods. Its child TokenProduct is used for bonus tokens distribution.
