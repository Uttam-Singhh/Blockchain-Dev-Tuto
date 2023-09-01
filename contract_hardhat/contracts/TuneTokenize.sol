// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error TuneTokenize__InvalidTokenUri();
error TuneTokenize__NeedMoreETHSent();
error TuneTokenize__CanOnlyBeBurnedIfOwnedByMinter();
error TuneTokenize__NothingToWithdraw();

contract TuneTokenize is ERC721, ERC721URIStorage, ERC721Burnable, Ownable {
    event Minted(address indexed _to, uint256 indexed _tokenId, string _tokenURI);

    using Counters for Counters.Counter;

    uint256 public constant MINT_PRICE_USD = 1; // 1 USD
    AggregatorV3Interface internal priceFeed;
    Counters.Counter public _tokenIdTracker; //unique IDs for every NFT minted

    // Mapping from token ID to minter address
    mapping(uint256 => address) public _minters;

    constructor(address priceFeedAddress) ERC721("Tune Tokenize", "TT") {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        // chainlink ETH/USD priceFeedAddress - 0x694AA1769357215DE4FAC081bf1f309aDC325306
    }

    // audit fixed to check for stale price data
    function getLatestPrice() public view returns (int) {
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();

     if(updatedAt < block.timestamp - 60 * 60 /* 1 hour */) {
       revert("stale price feed");
   }
        return price;
    }

    function getMintPriceETH() public view returns (uint256) {
        int256 currentETHPrice = getLatestPrice();
        uint256 decimals = 18; // This represents 1 ETH in Wei
        // Chainlink's price feeds come with 8 decimal places
        // So we need to divide curr price by 10^8 to get the correct price
        uint256 priceForOneUSDInWei = (10 ** decimals * 10 ** 8) / uint256(currentETHPrice);
        return priceForOneUSDInWei;
    }

    function mintToken(string memory _tokenURI) public payable {
        if (bytes(_tokenURI).length == 0) {
            revert TuneTokenize__InvalidTokenUri();
        }
        if (msg.value < getMintPriceETH()) {
            revert TuneTokenize__NeedMoreETHSent();
        }
        uint256 newTokenId = _tokenIdTracker.current();
        _tokenIdTracker.increment();
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);
        _minters[newTokenId] = msg.sender;
        emit Minted(msg.sender, newTokenId, _tokenURI);
    }

    function burn(uint256 tokenId) public override {
        if (!_isApprovedOrOwner(_msgSender(), tokenId) && _minters[tokenId] != msg.sender) {
            revert TuneTokenize__CanOnlyBeBurnedIfOwnedByMinter();
        }
        _burn(tokenId);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        if (balance <= 0) {
            revert TuneTokenize__NothingToWithdraw();
        }
        payable(msg.sender).transfer(balance);
    }

    function _setTokenURI(
        uint256 tokenId,
        string memory _tokenURI
    ) internal override(ERC721URIStorage) {
        super._setTokenURI(tokenId, _tokenURI);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        delete _minters[tokenId];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function getCurrentTokenId() public view returns (uint256) {
        return _tokenIdTracker.current();
    }

    function minterOf(uint256 tokenId) public view returns (address) {
        return _minters[tokenId];
    }
}