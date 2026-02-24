import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { fromBuffer } from 'pdf2pic';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from '@zxing/library';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractBase64Payload(value) {
  if (!value) return null;
  if (value.includes(',')) return value.split(',')[1];
  return value;
}

function decodeBarcodeFromPngBuffer(pngBuffer) {
  const parsed = PNG.sync.read(pngBuffer);

  // First pass: jsQR is often more robust for ticket QR codes
  const qrResult = jsQR(
    Uint8ClampedArray.from(parsed.data),
    parsed.width,
    parsed.height
  );
  if (qrResult?.data) {
    return qrResult.data;
  }

  // Fallback pass: ZXing supports multiple barcode formats
  const luminanceSource = new RGBLuminanceSource(
    Uint8ClampedArray.from(parsed.data),
    parsed.width,
    parsed.height
  );
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const result = reader.decode(binaryBitmap);
    return result?.getText?.() || null;
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    throw error;
  }
}

async function decodeBarcodeFromPdf(pdfBuffer, pageCount) {
  const pagesToScan = Math.min(pageCount, 3);
  const densities = [200, 300];

  for (const density of densities) {
    const converter = fromBuffer(pdfBuffer, {
      density,
      format: 'png',
      width: 1600,
      height: 2200,
      savePath: '/tmp',
      saveFilename: `tickr-verify-${density}`,
    });

    for (let page = 1; page <= pagesToScan; page++) {
      const converted = await converter(page, { responseType: 'base64' });
      const base64 = extractBase64Payload(converted?.base64 || null);
      if (!base64) continue;

      const pngBuffer = Buffer.from(base64, 'base64');
      const barcodeData = decodeBarcodeFromPngBuffer(pngBuffer);
      if (barcodeData) return barcodeData;
    }
  }

  return null;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseService.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json(
        { error: 'Geen bestand ontvangen voor verificatie.' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return Response.json(
        { error: 'Alleen PDF-bestanden zijn toegestaan.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: 'Bestand is te groot. Maximaal 10 MB.' },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    let pageCount = 0;

    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      pageCount = pdfDoc.getPageCount();
      if (pageCount < 1) {
        return Response.json(
          { error: 'Het PDF-bestand lijkt ongeldig of leeg.' },
          { status: 400 }
        );
      }
    } catch {
      return Response.json(
        { error: 'Het geuploade bestand is geen geldige PDF.' },
        { status: 400 }
      );
    }

    let barcodeData = null;
    try {
      barcodeData = await decodeBarcodeFromPdf(pdfBuffer, pageCount);
    } catch (decodeError) {
      console.error('[Ticket Verify] Barcode detectie fout:', decodeError);
      return Response.json(
        {
          error:
            'Barcode/QR detectie is mislukt. Controleer of het ticket een duidelijke barcode of QR-code bevat.',
        },
        { status: 500 }
      );
    }

    if (!barcodeData) {
      return Response.json(
        {
          verified: 'pending',
          barcodeData: null,
          warning:
            'Geen barcode of QR-code gedetecteerd. Ticket is geüpload met status pending en kan later handmatig gecontroleerd worden.',
        },
        { status: 200 }
      );
    }

    const { data: existingTicket, error: dupError } = await supabaseService
      .from('tickets')
      .select('id')
      .eq('barcode_data', barcodeData)
      .limit(1)
      .maybeSingle();

    if (dupError) {
      console.error('[Ticket Verify] Duplicate check error:', dupError);
      return Response.json(
        { error: 'Kon niet controleren op dubbele tickets.' },
        { status: 500 }
      );
    }

    if (existingTicket) {
      return Response.json(
        { error: 'Dit ticket is al eerder geüpload op Tckr.' },
        { status: 409 }
      );
    }

    return Response.json(
      {
        verified: 'verified',
        barcodeData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Ticket Verify] Unexpected error:', error);
    return Response.json(
      { error: 'Er ging iets mis bij het verifiëren van je ticket.' },
      { status: 500 }
    );
  }
}
