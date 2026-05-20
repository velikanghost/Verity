// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockPyth is IPyth {
    uint256 public feeAmount = 1 wei;

    // We can store a mock price to return
    mapping(bytes32 => PythStructs.Price) public prices;

    function setMockPrice(
        bytes32 priceFeedId,
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime
    ) external {
        prices[priceFeedId] = PythStructs.Price({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: publishTime
        });
    }

    // IPyth implementation

    function getUpdateFee(
        bytes[] calldata /* updateData */
    ) external view override returns (uint) {
        return feeAmount;
    }

    function parsePriceFeedUpdates(
        bytes[] calldata /* updateData */,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    )
        external
        payable
        override
        returns (PythStructs.PriceFeed[] memory priceFeeds)
    {
        if (msg.value < feeAmount) revert("InsufficientFee");

        priceFeeds = new PythStructs.PriceFeed[](priceIds.length);
        for (uint i = 0; i < priceIds.length; i++) {
            bytes32 id = priceIds[i];
            PythStructs.Price memory p = prices[id];

            // Validate the publish time is within the allowed range
            require(
                p.publishTime >= minPublishTime &&
                    p.publishTime <= maxPublishTime,
                "PriceFeedNotFoundWithinRange"
            );

            priceFeeds[i] = PythStructs.PriceFeed({
                id: id,
                price: p,
                emaPrice: p
            });
        }
    }

    // Remaining required IPyth functions (can revert/be empty as they are not used)
    function getPriceUnsafe(
        bytes32
    ) external pure override returns (PythStructs.Price memory) {
        revert("Unimplemented");
    }

    function getPriceNoOlderThan(
        bytes32,
        uint
    ) external pure override returns (PythStructs.Price memory) {
        revert("Unimplemented");
    }

    function getEmaPriceUnsafe(
        bytes32
    ) external pure override returns (PythStructs.Price memory) {
        revert("Unimplemented");
    }

    function getEmaPriceNoOlderThan(
        bytes32,
        uint
    ) external pure override returns (PythStructs.Price memory) {
        revert("Unimplemented");
    }

    function updatePriceFeeds(bytes[] calldata) external payable override {
        revert("Unimplemented");
    }

    function updatePriceFeedsIfNecessary(
        bytes[] calldata,
        bytes32[] calldata,
        uint64[] calldata
    ) external payable override {
        revert("Unimplemented");
    }

    function getTwapUpdateFee(
        bytes[] calldata
    ) external pure override returns (uint) {
        revert("Unimplemented");
    }

    function parsePriceFeedUpdatesWithConfig(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64,
        bool,
        bool,
        bool
    )
        external
        payable
        override
        returns (PythStructs.PriceFeed[] memory, uint64[] memory)
    {
        revert("Unimplemented");
    }

    function parseTwapPriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata
    ) external payable override returns (PythStructs.TwapPriceFeed[] memory) {
        revert("Unimplemented");
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        revert("Unimplemented");
    }
}
