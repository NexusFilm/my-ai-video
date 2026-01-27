import { AwsRegion, RenderMediaOnLambdaOutput } from "@remotion/lambda/client";
import {
  renderMediaOnLambda,
  speculateFunctionName,
} from "@remotion/lambda/client";
import {
  DISK,
  RAM,
  REGION,
  SITE_NAME,
  TIMEOUT,
} from "../../../../../config.mjs";
import { COMP_NAME } from "../../../../../types/constants";
import { RenderRequest } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";

export const POST = executeApi<RenderMediaOnLambdaOutput, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    if (
      !process.env.REMOTION_AWS_ACCESS_KEY_ID &&
      !process.env.AWS_ACCESS_KEY_ID
    ) {
      throw new TypeError(
        "Set REMOTION_AWS_ACCESS_KEY_ID in your Vercel environment variables",
      );
    }
    if (
      !process.env.REMOTION_AWS_SECRET_ACCESS_KEY &&
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      throw new TypeError(
        "Set REMOTION_AWS_SECRET_ACCESS_KEY in your Vercel environment variables",
      );
    }

    const result = await renderMediaOnLambda({
      codec: "h264",
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      serveUrl: SITE_NAME,
      composition: COMP_NAME,
      inputProps: body.inputProps,
      framesPerLambda: 60,
      downloadBehavior: {
        type: "download",
        fileName: "video.mp4",
      },
    });

    return result;
  },
);
